import { inject, Injectable } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { CV_LAYOUT, CV_SECTION_LABELS } from '../constants/cv-layout.constants';
import { DEFAULT_CV_PAGE_TUNE } from '../utils/cv-page-tune';
import type {
  CvEducationItem,
  CvExperienceItem,
  CvLanguage,
  GeneratedCvDraft,
} from '../models/cv.models';
import {
  buildDefaultPdfFileName,
  empresaPrompt,
  extractGithubUrl,
  habilidadesPrompt,
  localizeCvContentPrompt,
  parseJsonField,
  parseLocalizedCvContent,
  refineHabilidadesPrompt,
  refineSobreMiPrompt,
  slugifyEmpresa,
  sobreMiPrompt,
  splitNombreCompleto,
  type LocalizedCvContent,
} from '../prompts/cv-prompts';
import { draftLanguageMismatch, presentLabel } from '../utils/cv-language';
import { computePageTune } from '../utils/cv-page-tune';
import {
  fitHabilidadesToLayout,
  fitSobreMiToLayout,
  normalizeCvDraftSections,
  validateHabilidadesLineas,
  validateSobreMi,
} from '../utils/cv-validation';
import { GeminiService } from './gemini.service';
import { ProfileService } from './profile.service';
import { CvDraftService } from './cv-draft.service';

@Injectable({
  providedIn: 'root',
})
export class CvGenerationService {
  private readonly gemini = inject(GeminiService);
  private readonly profileService = inject(ProfileService);
  private readonly draftService = inject(CvDraftService);

  async generateFromOferta(user: User, ofertaTexto: string, language: CvLanguage): Promise<GeneratedCvDraft> {
    this.draftService.clear();
    const oferta = ofertaTexto.trim();

    try {
      this.draftService.setPhase('loading-profile', 'Cargando tu perfil maestro…');
      const perfil = await this.profileService.loadOrCreateProfile(user);
      const [experiencias, educaciones] = await Promise.all([
        this.profileService.loadExperiencias(perfil.id),
        this.profileService.loadEducaciones(perfil.id),
      ]);

      this.draftService.setPhase('generating-empresa', 'Detectando empresa de la convocatoria…');
      const empresaSlug = await this.inferEmpresaSlug(oferta);

      const sobreMi = await this.generateSobreMiWithRetry(
        language,
        perfil.sobre_mi_largo ?? '',
        perfil.carrera ?? '',
        oferta,
      );

      const habilidadesLineas = await this.generateHabilidadesWithRetry(
        language,
        perfil.habilidades_largo ?? '',
        oferta,
      );

      const initialSobreMi =
        validateSobreMi(sobreMi).valid ? sobreMi : fitSobreMiToLayout(sobreMi);
      const initialHabilidades =
        validateHabilidadesLineas(habilidadesLineas).valid ?
          habilidadesLineas
        : fitHabilidadesToLayout(habilidadesLineas);

      const { linea1, linea2 } = splitNombreCompleto(perfil.nombre_completo);
      let draft: GeneratedCvDraft = {
        language,
        ofertaTexto: oferta,
        empresaSlug,
        pdfFileName: buildDefaultPdfFileName(empresaSlug),
        nombreLinea1: linea1,
        nombreLinea2: linea2,
        carrera: perfil.carrera ?? '',
        ubicacion: perfil.ubicacion ?? '',
        telefono: perfil.telefono ?? '',
        correo: perfil.correo ?? '',
        portafolioUrl: perfil.portafolio_url ?? '',
        githubUrl: extractGithubUrl(perfil.portafolio_url),
        sobreMi: initialSobreMi,
        experiencias: this.mapExperiencias(experiencias, language),
        educaciones: this.mapEducaciones(educaciones),
        habilidadesLineas: initialHabilidades,
        sectionLabels: { ...CV_SECTION_LABELS[language] },
        pageTune: { ...DEFAULT_CV_PAGE_TUNE },
      };

      draft = await this.ensureDraftLanguage(draft);

      this.draftService.setPhase('validating', 'Validando extensión para 1 página…');
      const normalized = normalizeCvDraftSections(draft.sobreMi, draft.habilidadesLineas);
      draft = { ...draft, ...normalized };

      this.draftService.setPhase('tuning-layout', 'Ajustando espaciado a 1 página exacta…');
      draft = { ...draft, pageTune: computePageTune(draft) };

      this.draftService.setDraft(draft);
      return draft;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al generar el CV';
      this.draftService.setError(message);
      throw error;
    }
  }

  async refineSobreMi(instruction: string): Promise<string> {
    const draft = this.draftService.draft();
    if (!draft) throw new Error('No hay borrador de CV');

    const sobreMi = await this.refineSobreMiWithRetry(draft.language, draft.sobreMi, instruction);
    this.draftService.updateDraft((current) => ({ ...current, sobreMi }));
    return sobreMi;
  }

  async refineHabilidades(instruction: string): Promise<string[]> {
    const draft = this.draftService.draft();
    if (!draft) throw new Error('No hay borrador de CV');

    const habilidadesLineas = await this.refineHabilidadesWithRetry(
      draft.language,
      draft.habilidadesLineas,
      instruction,
    );
    this.draftService.updateDraft((current) => ({ ...current, habilidadesLineas }));
    return habilidadesLineas;
  }

  private async generateSobreMiWithRetry(
    language: CvLanguage,
    inventario: string,
    carrera: string,
    oferta: string,
  ): Promise<string> {
    let lastErrors: string[] = [];
    let previousAttempt = '';

    for (let attempt = 0; attempt < CV_LAYOUT.validationMaxAttempts; attempt++) {
      this.draftService.setPhase(
        'generating-sobre-mi',
        attempt === 0 ?
          'Generando sobre mí con IA…'
        : `Ajustando sobre mí (intento ${attempt + 1}/${CV_LAYOUT.validationMaxAttempts})…`,
      );

      const sobreMi = await this.generateSobreMi(
        language,
        inventario,
        carrera,
        oferta,
        {
          validationErrors: attempt > 0 ? lastErrors : undefined,
          strictLevel: attempt,
          previousAttempt: attempt > 0 ? previousAttempt : undefined,
        },
        attempt,
      );

      const validation = validateSobreMi(sobreMi);
      if (validation.valid) return sobreMi;

      lastErrors = validation.errors;
      previousAttempt = sobreMi;
    }

    const fitted = fitSobreMiToLayout(previousAttempt);
    const fittedValidation = validateSobreMi(fitted);
    if (fittedValidation.valid) return fitted;

    this.draftService.setPhase(
      'generating-sobre-mi',
      'Último ajuste de sobre mí con IA…',
    );
    const final = await this.generateSobreMi(
      language,
      inventario,
      carrera,
      oferta,
      {
        validationErrors: fittedValidation.errors,
        strictLevel: CV_LAYOUT.validationMaxAttempts,
        previousAttempt: fitted,
      },
      CV_LAYOUT.validationMaxAttempts,
    );
    const finalValidation = validateSobreMi(final);
    if (finalValidation.valid) return final;

    const lastResort = fitSobreMiToLayout(final);
    return lastResort;
  }

  private async generateHabilidadesWithRetry(
    language: CvLanguage,
    inventario: string,
    oferta: string,
  ): Promise<string[]> {
    let lastErrors: string[] = [];
    let previousAttempt: string[] = [];

    for (let attempt = 0; attempt < CV_LAYOUT.validationMaxAttempts; attempt++) {
      this.draftService.setPhase(
        'generating-habilidades',
        attempt === 0 ?
          'Seleccionando habilidades con IA…'
        : `Ajustando habilidades (intento ${attempt + 1}/${CV_LAYOUT.validationMaxAttempts})…`,
      );

      const habilidadesLineas = await this.generateHabilidades(
        language,
        inventario,
        oferta,
        {
          validationErrors: attempt > 0 ? lastErrors : undefined,
          strictLevel: attempt,
          previousAttempt: attempt > 0 ? previousAttempt : undefined,
        },
        attempt,
      );

      const validation = validateHabilidadesLineas(habilidadesLineas);
      if (validation.valid) return habilidadesLineas;

      lastErrors = validation.errors;
      previousAttempt = habilidadesLineas;
    }

    const fitted = fitHabilidadesToLayout(previousAttempt);
    const fittedValidation = validateHabilidadesLineas(fitted);
    if (fittedValidation.valid) return fitted;

    this.draftService.setPhase(
      'generating-habilidades',
      'Último ajuste de habilidades con IA…',
    );
    const final = await this.generateHabilidades(
      language,
      inventario,
      oferta,
      {
        validationErrors: fittedValidation.errors,
        strictLevel: CV_LAYOUT.validationMaxAttempts,
        previousAttempt: fitted,
      },
      CV_LAYOUT.validationMaxAttempts,
    );
    const finalValidation = validateHabilidadesLineas(final);
    if (finalValidation.valid) return final;

    return fitHabilidadesToLayout(final);
  }

  private async refineSobreMiWithRetry(
    language: CvLanguage,
    current: string,
    instruction: string,
  ): Promise<string> {
    let text = current;
    for (let attempt = 0; attempt < CV_LAYOUT.validationMaxAttempts; attempt++) {
      const { system, user } = refineSobreMiPrompt(language, text, instruction);
      const raw = await this.gemini.generateContent(user, {
        systemPrompt: system,
        temperature: Math.max(0.05, 0.15 - attempt * 0.02),
      });
      text = parseJsonField<string>(raw, 'sobreMi').trim();

      const validation = validateSobreMi(text);
      if (validation.valid) return text;

      if (attempt === CV_LAYOUT.validationMaxAttempts - 1) {
        const fitted = fitSobreMiToLayout(text);
        if (validateSobreMi(fitted).valid) return fitted;
        return fitted;
      }
    }

    return fitSobreMiToLayout(text);
  }

  private async refineHabilidadesWithRetry(
    language: CvLanguage,
    currentLines: string[],
    instruction: string,
  ): Promise<string[]> {
    let lines = currentLines;
    for (let attempt = 0; attempt < CV_LAYOUT.validationMaxAttempts; attempt++) {
      const { system, user } = refineHabilidadesPrompt(language, lines, instruction);
      const raw = await this.gemini.generateContent(user, {
        systemPrompt: system,
        temperature: Math.max(0.05, 0.15 - attempt * 0.02),
      });
      lines = parseJsonField<string[]>(raw, 'habilidades')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, CV_LAYOUT.habilidades.exactLines);

      const validation = validateHabilidadesLineas(lines);
      if (validation.valid) return lines;

      if (attempt === CV_LAYOUT.validationMaxAttempts - 1) {
        const fitted = fitHabilidadesToLayout(lines);
        if (validateHabilidadesLineas(fitted).valid) return fitted;
        return fitted;
      }
    }

    return fitHabilidadesToLayout(lines);
  }

  private async ensureDraftLanguage(draft: GeneratedCvDraft): Promise<GeneratedCvDraft> {
    const maxAttempts = 3;
    let current = draft;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const issues = draftLanguageMismatch(current);
      this.draftService.setPhase(
        'localizing',
        attempt === 0 ?
          `Verificando idioma del CV (${current.language === 'es' ? 'español' : 'inglés'})…`
        : `Corrigiendo idioma (intento ${attempt + 1}/${maxAttempts})…`,
      );

      const localized = await this.localizeDraftContent(current, issues.length ? issues : undefined);
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

  private async localizeDraftContent(
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
    const raw = await this.gemini.generateContent(user, {
      systemPrompt: system,
      temperature: 0.1,
    });
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
        nota: edu.nota?.trim() ?? '',
      })),
    };
  }

  private async inferEmpresaSlug(oferta: string): Promise<string> {
    const { system, user } = empresaPrompt(oferta, 'es');
    const raw = await this.gemini.generateContent(user, { systemPrompt: system, temperature: 0.1 });
    const empresa = parseJsonField<string>(raw, 'empresa');
    return slugifyEmpresa(empresa);
  }

  private async generateSobreMi(
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
    const raw = await this.gemini.generateContent(user, {
      systemPrompt: system,
      temperature: Math.max(0.05, 0.25 - attempt * 0.03),
    });
    return parseJsonField<string>(raw, 'sobreMi').trim();
  }

  private async generateHabilidades(
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
    const raw = await this.gemini.generateContent(user, {
      systemPrompt: system,
      temperature: Math.max(0.05, 0.2 - attempt * 0.025),
    });
    const lines = parseJsonField<string[]>(raw, 'habilidades');
    return lines.map((l) => l.trim()).filter(Boolean).slice(0, CV_LAYOUT.habilidades.exactLines);
  }

  private mapExperiencias(
    items: Awaited<ReturnType<ProfileService['loadExperiencias']>>,
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

  private mapEducaciones(
    items: Awaited<ReturnType<ProfileService['loadEducaciones']>>,
  ): CvEducationItem[] {
    return items.map((item) => ({
      lugar: item.lugar,
      titulo: item.titulo,
      fechaInicio: item.fecha_inicio ?? '',
      fechaFin: item.fecha_fin ?? '',
      nota: item.nota ?? '',
    }));
  }
}
