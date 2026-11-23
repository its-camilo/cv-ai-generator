import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from './env.js';

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    const url = requireEnv('SUPABASE_URL');
    const key =
      process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim() ||
      process.env['SUPABASE_SERVICE_KEY']?.trim();
    if (!key) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    }
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}