import type { SupabaseClient } from '@supabase/supabase-js';
import type { EducacionMaestra, ExperienciaMaestra, PerfilMaestro } from '../../src/app/core/models/profile.models.js';

export async function loadOrCreateProfile(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null,
  fullName?: string | null,
): Promise<PerfilMaestro> {
  const { data: rows, error: fetchError } = await supabase
    .from('perfiles_maestros')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1);

  if (fetchError) throw fetchError;
  const existing = rows?.[0] as PerfilMaestro | undefined;
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from('perfiles_maestros')
    .insert({
      user_id: userId,
      nombre_completo: fullName ?? email?.split('@')[0] ?? '',
      correo: email ?? null,
    })
    .select('*')
    .single();

  if (createError) throw createError;
  return created as PerfilMaestro;
}

export async function loadExperiencias(
  supabase: SupabaseClient,
  perfilId: string,
): Promise<ExperienciaMaestra[]> {
  const { data, error } = await supabase
    .from('experiencias_maestras')
    .select('*')
    .eq('perfil_id', perfilId)
    .order('orden', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ExperienciaMaestra[];
}

export async function loadEducaciones(
  supabase: SupabaseClient,
  perfilId: string,
): Promise<EducacionMaestra[]> {
  const { data, error } = await supabase
    .from('educaciones_maestras')
    .select('*')
    .eq('perfil_id', perfilId)
    .order('orden', { ascending: true });
  if (error) throw error;
  return (data ?? []) as EducacionMaestra[];
}