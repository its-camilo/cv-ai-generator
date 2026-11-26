import type { SupabaseClient } from '@supabase/supabase-js';
import { CV_LAYOUT, CV_SECTION_LABELS } from '../../src/app/core/constants/cv-layout.constants.js';
import type { CvLanguage, CvExperienceItem, CvEducationItem, GeneratedCvDraft } from '../../src/app/core/models/cv.models.js';
import {
  buildDefaultPdfFileName,
  empresaPrompt,
  extractGithubUrl,
  habilidadesPrompt,
  localizeCvContentPrompt,
  parseJsonField,
  parseLocalizedCvContent,
  slugifyEmpresa,
  sobreMiPrompt,
  splitNombreCompleto,
  type LocalizedCvContent,
} from '../../src/app/core/prompts/cv-prompts.js';
import { draftLanguageMismatch, presentLabel } from '../../src/app/core/utils/cv-language.js';
import { computePageTune, DEFAULT_CV_PAGE_TUNE } from '../../src/app/core/utils/cv-page-tune.js';
import {
  fitHabilidadesToLayout,
  fitSobreMiToLayout,
  normalizeCvDraftSections,
  sanitizeEducationNota,
  validateHabilidadesLineas,
  validateSobreMi,
} from '../../src/app/core/utils/cv-validation.js';
import { generateContentWithRetry } from './gemini-server.js';
import type { EducacionMaestra, ExperienciaMaestra, PerfilMaestro } from '../../src/app/core/models/profile.models.js';
import { loadEducaciones, loadExperiencias, loadOrCreateProfile } from './profile-server.js';

export interface GenerateCvInput {
  ofertaTexto: string;
  language?: CvLanguage;
  empresaSlugOverride?: string;
}

export interface GenerationSources {
  perfil: PerfilMaestro;
  experiencias: ExperienciaMaestra[];
  educaciones: EducacionMaestra[];
}

/** Fase 1: perfil maestro, experiencias y educaciones del usuario. */
export async function loadGenerationSources(
  supabase: SupabaseClient,
  userId: string,
  userMeta?: { email?: string | null; fullName?: string | null },
): Promise<GenerationSources> {
  const perfil = await loadOrCreateProfile(supabase, userId, userMeta?.email, userMeta?.fullName);
  const [experiencias, educaciones] = await Promise.all([
    loadExperiencias(supabase, perfil.id),
    loadEducaciones(supabase, perfil.id),
  ]);
  return { perfil, experiencias, educaciones };
}

/** Fase 5: arma el borrador, asegura idioma, normaliza secciones y calcula pageTune. */
export async function buildLocalizedDraft(
  supabase: SupabaseClient,
  sources: GenerationSources,
  input: {
    language: CvLanguage;
    oferta: string;
    empresaSlug: string;
    sobreMi: string;
    habilidadesLineas: string[];
  },
): Promise<GeneratedCvDraft> {
  const { perfil, experiencias, educaciones } = sources;
  const { language, oferta, empresaSlug, sobreMi, habilidadesLineas } = input;

  const initialSobreMi = validateSobreMi(sobreMi).valid ? sobreMi : fitSobreMiToLayout(sobreMi);
  const initialHabilidades = validateHabilidadesLineas(habilidadesLineas).valid
    ? habilidadesLineas
    : fitHabilidadesToLayout(habilidadesLineas);

  const { linea1, linea2 } = splitNombreCompleto(perfil.nombre_completo);
  let draft: GeneratedCvDraft = {
    language,
    ofertaTexto: oferta,
    empresaSlug,
    pdfFileName: buildDefaultPdfFileName(empresaSlug, perfil.nombre_completo),
    nombreLinea1: linea1,
    nombreLinea2: linea2,
    carrera: perfil.carrera ?? '',
    ubicacion: perfil.ubicacion ?? '',
    telefono: perfil.telefono ?? '',
    correo: perfil.correo ?? '',
    portafolioUrl: perfil.portafolio_url ?? '',
    githubUrl: extractGithubUrl(perfil.portafolio_url),
    sobreMi: initialSobreMi,
    experiencias: mapExperiencias(experiencias, language),
    educaciones: mapEducaciones(educaciones),
    habilidadesLineas: initialHabilidades,
    sectionLabels: { ...CV_SECTION_LABELS[language] },
    pageTune: { ...DEFAULT_CV_PAGE_TUNE },
  };

  draft = await ensureDraftLanguage(supabase, draft);
  const normalized = normalizeCvDraftSections(draft.sobreMi, draft.habilidadesLineas);
  draft = { ...draft, ...normalized, pageTune: computePageTune({ ...draft, ...normalized }) };

  return draft;
}

/** Fase 2: infiere el slug de empresa (1 llamada a Gemini). */
export async function inferEmpresaSlug(supabase: SupabaseClient, oferta: string): Promise<string> {
  const { system, user } = empresaPrompt(oferta, 'es');
  const raw = await generateContentWithRetry(supabase, user, { systemPrompt: system, temperature: 0.1 });
  const empresa = parseJsonField<string>(raw, 'empresa');
  return slugifyEmpresa(empresa);
}

/** Fase 3: sobreMi con hasta CV_LAYOUT.validationMaxAttempts reintentos de validación. */
export async function generateSobreMiWithRetry(
  supabase: SupabaseClient,
  language: CvLanguage,
  inventario: string,
  carrera: string,
  oferta: string,
): Promise<string> {
  let lastErrors: string[] = [];
  let previousAttempt = '';

  for (let attempt = 0; attempt < CV_LAYOUT.validationMaxAttempts; attempt++) {
    const sobreMi = await generateSobreMi(supabase, language, inventario, carrera, oferta, {
      validationErrors: attempt > 0 ? lastErrors : undefined,
      strictLevel: attempt,
      previousAttempt: attempt > 0 ? previousAttempt : undefined,
    }, attempt);

    const validation = validateSobreMi(sobreMi);
    if (validation.valid) return sobreMi;
    lastErrors = validation.errors;
    previousAttempt = sobreMi;
  }

  const fitted = fitSobreMiToLayout(previousAttempt);
  if (validateSobreMi(fitted).valid) return fitted;

  const final = await generateSobreMi(
    supabase,
    language,
    inventario,
    carrera,
    oferta,
    {
      validationErrors: validateSobreMi(fitted).errors,
      strictLevel: CV_LAYOUT.validationMaxAttempts,
      previousAttempt: fitted,
    },
    CV_LAYOUT.validationMaxAttempts,
  );
  return validateSobreMi(final).valid ? final : fitSobreMiToLayout(final);
}

/** Fase 4: habilidades con hasta CV_LAYOUT.validationMaxAttempts reintentos de validación. */
export async function generateHabilidadesWithRetry(
  supabase: SupabaseClient,
  language: CvLanguage,
  inventario: string,
  oferta: string,
): Promise<string[]> {
  let lastErrors: string[] = [];
  let previousAttempt: string[] = [];

  for (let attempt = 0; attempt < CV_LAYOUT.validationMaxAttempts; attempt++) {
    const habilidadesLineas = await generateHabilidades(supabase, language, inventario, oferta, {
      validationErrors: attempt > 0 ? lastErrors : undefined,
      strictLevel: attempt,
      previousAttempt: attempt > 0 ? previousAttempt : undefined,
    }, attempt);

    const validation = validateHabilidadesLineas(habilidadesLineas);
    if (validation.valid) return habilidadesLineas;
    lastErrors = validation.errors;
    previousAttempt = habilidadesLineas;
  }

  const fitted = fitHabilidadesToLayout(previousAttempt);
  if (validateHabilidadesLineas(fitted).valid) return fitted;

  const final = await generateHabilidades(
    supabase,
    language,
    inventario,
    oferta,
    {
      validationErrors: validateHabilidadesLineas(fitted).errors,
      strictLevel: CV_LAYOUT.validationMaxAttempts,
      previousAttempt: fitted,
    },
    CV_LAYOUT.validationMaxAttempts,
  );
  return validateHabilidadesLineas(final).valid ? final : fitHabilidadesToLayout(final);
}

async function ensureDraftLanguage(supabase: SupabaseClient, draft: GeneratedCvDraft): Promise<GeneratedCvDraft> {
  const maxAttempts = 3;
  let current = draft;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const issues = draftLanguageMismatch(current);
    const localized = await localizeDraftContent(supabase, current, issues.length ? issues : undefined);
    current = {
      ...current,
      carrera: localized.carrera,
      sobreMi: localized.sobreMi,
      habilidadesLineas: localized.habilidades,
      experiencias: localized.experiencias,
      educaciones: localized.educaciones,
      sectionLabels: { ...CV_SECTION_LABELS[current.language] },
    };
    if (draftLanguageMismatch(current).length === 0) return current;
  }

  return current;
}

async function localizeDraftContent(
  supabase: SupabaseClient,
  draft: GeneratedCvDraft,
  issues?: string[],
): Promise<LocalizedCvContent> {
  const content: LocalizedCvContent = {
    carrera: draft.carrera,
    sobreMi: draft.sobreMi,
    habilidades: draft.habilidadesLineas,
    experiencias: draft.experiencias,
    educaciones: draft.educaciones,
  };

  const { system, user } = localizeCvContentPrompt(draft.language, content, issues);
  const raw = await generateContentWithRetry(supabase, user, { systemPrompt: system, temperature: 0.1 });
  const localized = parseLocalizedCvContent(raw);

  return {
    carrera: localized.carrera.trim(),
    sobreMi: localized.sobreMi.trim(),
    habilidades: localized.habilidades
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, CV_LAYOUT.habilidades.exactLines),
    experiencias: localized.experiencias.map((exp) => ({
      lugar: exp.lugar?.trim() ?? '',
      cargo: exp.cargo?.trim() ?? '',
      fechaInicio: exp.fechaInicio?.trim() ?? '',
      fechaFin: exp.fechaFin?.trim() || presentLabel(draft.language),
      descripcion: exp.descripcion?.trim() ?? '',
    })),
    educaciones: localized.educaciones.map((edu) => ({
      lugar: edu.lugar?.trim() ?? '',
      titulo: edu.titulo?.trim() ?? '',
      fechaInicio: edu.fechaInicio?.trim() ?? '',
      fechaFin: edu.fechaFin?.trim() ?? '',
      nota: sanitizeEducationNota(edu.nota),
    })),
  };
}

async function generateSobreMi(
  supabase: SupabaseClient,
  language: CvLanguage,
  inventario: string,
  carrera: string,
  oferta: string,
  options?: {
    validationErrors?: string[];
    strictLevel?: number;
    previousAttempt?: string;
  },
  attempt = 0,
): Promise<string> {
  const { system, user } = sobreMiPrompt(language, inventario, carrera, oferta, options);
  const raw = await generateContentWithRetry(supabase, user, {
    systemPrompt: system,
    temperature: Math.max(0.05, 0.25 - attempt * 0.03),
  });
  return parseJsonField<string>(raw, 'sobreMi').trim();
}

async function generateHabilidades(
  supabase: SupabaseClient,
  language: CvLanguage,
  inventario: string,
  oferta: string,
  options?: {
    validationErrors?: string[];
    strictLevel?: number;
    previousAttempt?: string[];
  },
  attempt = 0,
): Promise<string[]> {
  const { system, user } = habilidadesPrompt(language, inventario, oferta, options);
  const raw = await generateContentWithRetry(supabase, user, {
    systemPrompt: system,
    temperature: Math.max(0.05, 0.2 - attempt * 0.025),
  });
  const lines = parseJsonField<string[]>(raw, 'habilidades');
  return lines.map((l) => l.trim()).filter(Boolean).slice(0, CV_LAYOUT.habilidades.exactLines);
}

function mapExperiencias(
  items: ExperienciaMaestra[],
  language: CvLanguage,
): CvExperienceItem[] {
  const present = presentLabel(language);
  return items.map((item) => ({
    lugar: item.lugar,
    cargo: item.cargo,
    fechaInicio: item.fecha_inicio ?? '',
    fechaFin: item.fecha_fin?.trim() ? item.fecha_fin : present,
    descripcion: item.descripcion ?? '',
  }));
}

function mapEducaciones(
  items: EducacionMaestra[],
): CvEducationItem[] {
  return items.map((item) => ({
    lugar: item.lugar,
    titulo: item.titulo,
    fechaInicio: item.fecha_inicio ?? '',
    fechaFin: item.fecha_fin ?? '',
    nota: sanitizeEducationNota(item.nota),
  }));
}