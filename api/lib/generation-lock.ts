import { getSupabaseAdmin } from './supabase-admin.js';

const LOCK_TTL_MS = 20 * 60 * 1000;

export class GenerationBusyError extends Error {
  constructor() {
    super('Ya hay una generación de CV en curso para esta cuenta. Espera a que termine e inténtalo de nuevo.');
    this.name = 'GenerationBusyError';
  }
}

export async function withUserGenerationLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
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

  try {
    return await fn();
  } finally {
    await admin.from('mcp_generation_locks').delete().eq('user_id', userId);
  }
}