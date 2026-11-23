import type { SupabaseClient } from '@supabase/supabase-js';
import type { GeneratedCvDraft } from '../../src/app/core/models/cv.models.js';

const CV_BUCKET = 'cvs';
const LINK_TTL_SECONDS = 60 * 60 * 24 * 7;

export function safeFileName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '').replace(/[^\w\-]+/g, '_') || 'CV';
}

export async function uploadCvPdf(
  supabase: SupabaseClient,
  userId: string,
  draft: GeneratedCvDraft,
  pdf: Buffer,
): Promise<{ signedUrl: string; storagePath: string; downloadFileName: string }> {
  const safe = safeFileName(draft.pdfFileName);
  const storagePath = `${userId}/${safe}-${Date.now()}.pdf`;

  const { error: uploadError } = await supabase.storage.from(CV_BUCKET).upload(storagePath, pdf, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase.storage
    .from(CV_BUCKET)
    .createSignedUrl(storagePath, LINK_TTL_SECONDS, { download: `${safe}.pdf` });
  if (error || !data) throw error ?? new Error('No se pudo crear el enlace firmado.');

  await supabase.from('cv_generations').insert({
    user_id: userId,
    storage_path: storagePath,
    pdf_file_name: safe,
    empresa_slug: draft.empresaSlug,
    language: draft.language,
    sobre_mi_preview: draft.sobreMi.slice(0, 400),
  });

  return { signedUrl: data.signedUrl, storagePath, downloadFileName: `${safe}.pdf` };
}

export async function listRecentGenerations(
  supabase: SupabaseClient,
  userId: string,
  limit = 10,
): Promise<
  Array<{
    id: string;
    pdfFileName: string;
    empresaSlug: string | null;
    language: string;
    createdAt: string;
    downloadUrl: string | null;
    sobreMiPreview: string | null;
  }>
> {
  const { data, error } = await supabase
    .from('cv_generations')
    .select('id, pdf_file_name, empresa_slug, language, created_at, storage_path, sobre_mi_preview')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = data ?? [];
  return Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await supabase.storage
        .from(CV_BUCKET)
        .createSignedUrl(row.storage_path, LINK_TTL_SECONDS, {
          download: `${row.pdf_file_name}.pdf`,
        });
      return {
        id: row.id,
        pdfFileName: row.pdf_file_name,
        empresaSlug: row.empresa_slug,
        language: row.language,
        createdAt: row.created_at,
        downloadUrl: signed?.signedUrl ?? null,
        sobreMiPreview: row.sobre_mi_preview,
      };
    }),
  );
}