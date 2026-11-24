/** Mensaje legible a partir de errores PostgREST / Supabase JS. */
export function formatSupabaseError(error: unknown): string {
  if (!error) return 'Error desconocido';

  if (error instanceof Error) {
    const extra = error as Error & { details?: string; hint?: string; code?: string };
    const parts = [error.message, extra.details, extra.hint, extra.code ? `(${extra.code})` : '']
      .map((p) => p?.trim())
      .filter(Boolean);
    if (parts.length) return parts.join(' — ');
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const record = error as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [record.message, record.details, record.hint, record.code ? `(${record.code})` : '']
      .map((p) => p?.trim())
      .filter(Boolean);
    if (parts.length) return parts.join(' — ');
  }

  return String(error);
}