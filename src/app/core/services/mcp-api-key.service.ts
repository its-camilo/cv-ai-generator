import { inject, Injectable } from '@angular/core';
import { formatSupabaseError } from '../utils/supabase-error';
import { SupabaseService } from './supabase.service';

export interface McpApiKeyRow {
  id: string;
  key_prefix: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface CreatedMcpApiKey {
  id: string;
  apiKey: string;
  prefix: string;
  label: string | null;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class McpApiKeyService {
  private readonly supabase = inject(SupabaseService).getClient();

  async listActiveKeys(): Promise<McpApiKeyRow[]> {
    const { data, error } = await this.supabase
      .from('mcp_api_keys')
      .select('id, key_prefix, label, created_at, last_used_at, revoked_at')
      .is('revoked_at', null)
      .order('created_at', { ascending: false });

    if (error) throw new Error(formatSupabaseError(error));
    return (data ?? []) as McpApiKeyRow[];
  }

  async createKey(label?: string): Promise<CreatedMcpApiKey> {
    const { data, error } = await this.supabase.rpc('create_mcp_api_key', {
      p_label: label?.trim() || null,
    });
    if (error) throw new Error(formatSupabaseError(error));
    if (!data) throw new Error('La función no devolvió datos de la clave.');
    const payload = data as {
      id: string;
      apiKey: string;
      prefix: string;
      label: string | null;
      createdAt: string;
    };
    return {
      id: payload.id,
      apiKey: payload.apiKey,
      prefix: payload.prefix,
      label: payload.label,
      createdAt: payload.createdAt,
    };
  }

  async revokeKey(id: string): Promise<void> {
    const { error } = await this.supabase.rpc('revoke_mcp_api_key', { p_id: id });
    if (error) throw new Error(formatSupabaseError(error));
  }
}