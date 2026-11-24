import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from './supabase-admin.js';

export interface AuthenticatedMcpUser {
  userId: string;
  keyId?: string;
}

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey.trim()).digest('hex');
}

export function parseBearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/** Resuelve la clave MCP al user_id (hash en DB vía RPC o consulta directa con service role). */
export async function authenticateMcpRequest(
  authorization: string | undefined,
): Promise<AuthenticatedMcpUser | null> {
  const token = parseBearerToken(authorization);
  if (!token) return null;

  const admin = getSupabaseAdmin();

  const { data: viaRpc, error: rpcError } = await admin.rpc('resolve_mcp_api_key', {
    p_raw_key: token,
  });

  if (!rpcError) {
    return viaRpc ? { userId: viaRpc as string } : null;
  }

  const keyHash = hashApiKey(token);
  const { data: row, error } = await admin
    .from('mcp_api_keys')
    .select('id, user_id')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .maybeSingle();

  if (error || !row) return null;

  await admin.from('mcp_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', row.id);

  return { userId: row.user_id, keyId: row.id };
}