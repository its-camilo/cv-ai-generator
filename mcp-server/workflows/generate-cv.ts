import { FatalError } from 'workflow';
import type { CvLanguage, GeneratedCvDraft } from '../../src/app/core/models/cv.models.js';
import {
  buildLocalizedDraft,
  generateHabilidadesWithRetry,
  generateSobreMiWithRetry,
  inferEmpresaSlug,
  loadGenerationSources,
  type GenerationSources,
} from '../lib/cv-generation-server.js';
import { renderCvHtml } from '../lib/cv-html.js';
import { htmlToPdfBuffer } from '../lib/cv-pdf.js';
import { uploadCvPdf } from '../lib/cv-storage.js';
import {
  acquireUserGenerationLock,
  GenerationBusyError,
  releaseUserGenerationLock,
} from '../lib/generation-lock.js';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

export interface GenerateCvWorkflowInput {
  userId: string;
  /** Texto completo de la oferta, ya recortado. */
  oferta: string;
  language: CvLanguage;
  empresaSlugOverride?: string;
}

export interface GenerateCvWorkflowResult {
  downloadUrl: string;
  fileName: string;
  storagePath: string;
  language: CvLanguage;
  empresaSlug: string;
  pdfFileName: string;
  sobreMi: string;
  habilidadesLineas: string[];
}

/**
 * Orquesta la generación de un CV vía MCP. Corre en el sandbox de Workflow (sin Node):
 * todo el trabajo real vive en los steps, cada uno con su propio presupuesto de duración.
 */
export async function generateCvWorkflow(input: GenerateCvWorkflowInput): Promise<GenerateCvWorkflowResult> {
  'use workflow';

  const { userId, oferta, language } = input;

  await acquireLockStep(userId);
  try {
    const sources = await loadSourcesStep(userId);
    const empresaSlug = input.empresaSlugOverride?.trim() || (await inferEmpresaSlugStep(oferta));
    const sobreMi = await generateSobreMiStep(language, sources, oferta);
    const habilidadesLineas = await generateHabilidadesStep(language, sources, oferta);
    const draft = await localizeDraftStep(sources, {
      language,
      oferta,
      empresaSlug,
      sobreMi,
      habilidadesLineas,
    });
    const html = await renderHtmlStep(draft);
    const pdf = await renderPdfStep(html);
    const uploaded = await uploadAndRecordStep(userId, draft, pdf);

    return {
      downloadUrl: uploaded.signedUrl,
      fileName: uploaded.downloadFileName,
      storagePath: uploaded.storagePath,
      language: draft.language,
      empresaSlug: draft.empresaSlug,
      pdfFileName: draft.pdfFileName,
      sobreMi: draft.sobreMi,
      habilidadesLineas: draft.habilidadesLineas,
    };
  } finally {
    await releaseLockStep(userId);
  }
}

async function acquireLockStep(userId: string): Promise<void> {
  'use step';
  try {
    await acquireUserGenerationLock(userId);
  } catch (error) {
    // Otro run tiene el lock: no reintentar ni liberar el lock ajeno.
    if (error instanceof GenerationBusyError) throw new FatalError(error.message);
    throw error;
  }
}

async function releaseLockStep(userId: string): Promise<void> {
  'use step';
  await releaseUserGenerationLock(userId);
}

async function loadSourcesStep(userId: string): Promise<GenerationSources> {
  'use step';
  return loadGenerationSources(getSupabaseAdmin(), userId);
}

async function inferEmpresaSlugStep(oferta: string): Promise<string> {
  'use step';
  return inferEmpresaSlug(getSupabaseAdmin(), oferta);
}

async function generateSobreMiStep(
  language: CvLanguage,
  sources: GenerationSources,
  oferta: string,
): Promise<string> {
  'use step';
  return generateSobreMiWithRetry(
    getSupabaseAdmin(),
    language,
    sources.perfil.sobre_mi_largo ?? '',
    sources.perfil.carrera ?? '',
    oferta,
  );
}

async function generateHabilidadesStep(
  language: CvLanguage,
  sources: GenerationSources,
  oferta: string,
): Promise<string[]> {
  'use step';
  return generateHabilidadesWithRetry(
    getSupabaseAdmin(),
    language,
    sources.perfil.habilidades_largo ?? '',
    oferta,
  );
}

async function localizeDraftStep(
  sources: GenerationSources,
  input: {
    language: CvLanguage;
    oferta: string;
    empresaSlug: string;
    sobreMi: string;
    habilidadesLineas: string[];
  },
): Promise<GeneratedCvDraft> {
  'use step';
  return buildLocalizedDraft(getSupabaseAdmin(), sources, input);
}

async function renderHtmlStep(draft: GeneratedCvDraft): Promise<string> {
  'use step';
  return renderCvHtml(draft);
}

async function renderPdfStep(html: string): Promise<Uint8Array> {
  'use step';
  return htmlToPdfBuffer(html);
}

async function uploadAndRecordStep(
  userId: string,
  draft: GeneratedCvDraft,
  pdf: Uint8Array,
): Promise<{ signedUrl: string; storagePath: string; downloadFileName: string }> {
  'use step';
  return uploadCvPdf(getSupabaseAdmin(), userId, draft, pdf);
}
