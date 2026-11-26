import { getSupabaseAdmin } from './supabase-admin.js';

const LOCK_TTL_MS = 20 * 60 * 1000;

export class GenerationBusyError extends Error {
  constructor() {
    super('Ya hay una generación de CV en curso para esta cuenta. Espera a que termine e inténtalo de nuevo.');
    this.name = 'GenerationBusyError';
  }
}

/** Inserta el lock del usuario (TTL 20 min). Lanza GenerationBusyError si hay otro vigente. */
export async function acquireUserGenerationLock(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const now = new Date();
  const expires = new Date(now.getTime() + LOCK_TTL_MS);

  await admin.from('mcp_generation_locks').delete().eq('user_id', userId).lt('expires_at', now.toISOString());

  const { error: insertError } = await admin.from('mcp_generation_locks').insert({
    user_id: userId,
    locked_at: now.toISOString(),
    expires_at: expires.toISOString(),
  });

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: existing } = await admin
        .from('mcp_generation_locks')
        .select('expires_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (existing && new Date(existing.expires_at) > now) {
        throw new GenerationBusyError();
      }
      await admin.from('mcp_generation_locks').delete().eq('user_id', userId);
      const retry = await admin.from('mcp_generation_locks').insert({
        user_id: userId,
        locked_at: now.toISOString(),
        expires_at: expires.toISOString(),
      });
      if (retry.error) throw new GenerationBusyError();
    } else {
      throw insertError;
    }
  }
}

export async function releaseUserGenerationLock(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from('mcp_generation_locks').delete().eq('user_id', userId);
}

/** Lectura sin efectos: true si el usuario tiene un lock vigente (no expirado). */
export async function hasActiveGenerationLock(userId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('mcp_generation_locks')
    .select('expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data && new Date(data.expires_at) > new Date();
}
