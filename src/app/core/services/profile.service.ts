import { inject, Injectable } from '@angular/core';
import { User } from '@supabase/supabase-js';
import {
  EducacionMaestra,
  ExperienciaMaestra,
  PerfilMaestro,
} from '../models/profile.models';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly supabase = inject(SupabaseService).getClient();
  private readonly profileLoadByUser = new Map<string, Promise<PerfilMaestro>>();

  async loadOrCreateProfile(user: User): Promise<PerfilMaestro> {
    const inFlight = this.profileLoadByUser.get(user.id);
    if (inFlight) return inFlight;

    const loadPromise = this.doLoadOrCreateProfile(user);
    this.profileLoadByUser.set(user.id, loadPromise);

    try {
      return await loadPromise;
    } finally {
      this.profileLoadByUser.delete(user.id);
    }
  }

  private async doLoadOrCreateProfile(user: User): Promise<PerfilMaestro> {
    const { data: rows, error: fetchError } = await this.supabase
      .from('perfiles_maestros')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1);

    const existing = rows?.[0] ?? null;

    if (fetchError) throw fetchError;
    if (existing) return existing as PerfilMaestro;

    const { data: created, error: createError } = await this.supabase
      .from('perfiles_maestros')
      .insert({
        user_id: user.id,
        nombre_completo: user.user_metadata?.['full_name'] ?? user.email?.split('@')[0] ?? '',
        correo: user.email ?? null,
      })
      .select('*')
      .single();

    if (createError?.code === '23505') {
      const { data: retryRows, error: retryError } = await this.supabase
        .from('perfiles_maestros')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (retryError) throw retryError;
      const retryExisting = retryRows?.[0];
      if (retryExisting) return retryExisting as PerfilMaestro;
    }

    if (createError) throw createError;
    return created as PerfilMaestro;
  }

  async updatePerfil(
    perfilId: string,
    fields: Partial<
      Pick<
        PerfilMaestro,
        | 'nombre_completo'
        | 'carrera'
        | 'ubicacion'
        | 'telefono'
        | 'correo'
        | 'portafolio_url'
        | 'sobre_mi_largo'
        | 'habilidades_largo'
      >
    >,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('perfiles_maestros')
      .update(fields)
      .eq('id', perfilId);

    if (error) throw error;
  }

  async loadExperiencias(perfilId: string): Promise<ExperienciaMaestra[]> {
    const { data, error } = await this.supabase
      .from('experiencias_maestras')
      .select('*')
      .eq('perfil_id', perfilId)
      .order('orden', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ExperienciaMaestra[];
  }

  async upsertExperiencia(
    perfilId: string,
    item: ExperienciaMaestra,
    orden: number,
  ): Promise<ExperienciaMaestra> {
    const payload = {
      perfil_id: perfilId,
      lugar: item.lugar.trim(),
      cargo: item.cargo.trim(),
      fecha_inicio: item.fecha_inicio?.trim() || null,
      fecha_fin: item.fecha_fin?.trim() || null,
      descripcion: item.descripcion?.trim() || null,
      orden,
    };

    if (item.id.startsWith('temp-')) {
      const { data, error } = await this.supabase
        .from('experiencias_maestras')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw error;
      return data as ExperienciaMaestra;
    }

    const { data, error } = await this.supabase
      .from('experiencias_maestras')
      .update(payload)
      .eq('id', item.id)
      .select('*')
      .single();

    if (error) throw error;
    return data as ExperienciaMaestra;
  }

  async deleteExperiencia(id: string): Promise<void> {
    if (id.startsWith('temp-')) return;
    const { error } = await this.supabase.from('experiencias_maestras').delete().eq('id', id);
    if (error) throw error;
  }

  async reorderExperiencias(items: ExperienciaMaestra[]): Promise<void> {
    const updates = items
      .map((item, index) => ({ id: item.id, orden: index }))
      .filter((item) => !item.id.startsWith('temp-'))
      .map(({ id, orden }) =>
        this.supabase.from('experiencias_maestras').update({ orden }).eq('id', id),
      );

    const results = await Promise.all(updates);
    for (const { error } of results) {
      if (error) throw error;
    }
  }

  async loadEducaciones(perfilId: string): Promise<EducacionMaestra[]> {
    const { data, error } = await this.supabase
      .from('educaciones_maestras')
      .select('*')
      .eq('perfil_id', perfilId)
      .order('orden', { ascending: true });

    if (error) throw error;
    return (data ?? []) as EducacionMaestra[];
  }

  async upsertEducacion(
    perfilId: string,
    item: EducacionMaestra,
    orden: number,
  ): Promise<EducacionMaestra> {
    const payload = {
      perfil_id: perfilId,
      lugar: item.lugar.trim(),
      titulo: item.titulo.trim(),
      fecha_inicio: item.fecha_inicio?.trim() || null,
      fecha_fin: item.fecha_fin?.trim() || null,
      nota: item.nota?.trim() || null,
      orden,
    };

    if (item.id.startsWith('temp-')) {
      const { data, error } = await this.supabase
        .from('educaciones_maestras')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw error;
      return data as EducacionMaestra;
    }

    const { data, error } = await this.supabase
      .from('educaciones_maestras')
      .update(payload)
      .eq('id', item.id)
      .select('*')
      .single();

    if (error) throw error;
    return data as EducacionMaestra;
  }

  async deleteEducacion(id: string): Promise<void> {
    if (id.startsWith('temp-')) return;
    const { error } = await this.supabase.from('educaciones_maestras').delete().eq('id', id);
    if (error) throw error;
  }

  async reorderEducaciones(items: EducacionMaestra[]): Promise<void> {
    const updates = items
      .map((item, index) => ({ id: item.id, orden: index }))
      .filter((item) => !item.id.startsWith('temp-'))
      .map(({ id, orden }) =>
        this.supabase.from('educaciones_maestras').update({ orden }).eq('id', id),
      );

    const results = await Promise.all(updates);
    for (const { error } of results) {
      if (error) throw error;
    }
  }
}
