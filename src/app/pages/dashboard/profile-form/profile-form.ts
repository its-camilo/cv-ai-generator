import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { User } from '@supabase/supabase-js';
import {
  EducacionMaestra,
  ExperienciaMaestra,
  PerfilMaestro,
  SaveState,
} from '../../../core/models/profile.models';
import { ProfileService } from '../../../core/services/profile.service';

type PerfilField =
  | 'nombre_completo'
  | 'carrera'
  | 'ubicacion'
  | 'telefono'
  | 'correo'
  | 'portafolio_url'
  | 'sobre_mi_largo'
  | 'habilidades_largo';

@Component({
  selector: 'app-profile-form',
  imports: [DecimalPipe],
  templateUrl: './profile-form.html',
  styleUrl: './profile-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileForm {
  readonly user = input.required<User>();

  private readonly profileService = inject(ProfileService);

  readonly perfil = signal<PerfilMaestro | null>(null);
  readonly experiencias = signal<ExperienciaMaestra[]>([]);
  readonly educaciones = signal<EducacionMaestra[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly fieldStates = signal<Record<string, SaveState>>({});

  constructor() {
    effect(() => {
      const currentUser = this.user();
      void this.loadProfile(currentUser);
    });
  }

  private async loadProfile(user: User): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);

    try {
      const perfil = await this.profileService.loadOrCreateProfile(user);
      this.perfil.set(perfil);

      const [experiencias, educaciones] = await Promise.all([
        this.profileService.loadExperiencias(perfil.id),
        this.profileService.loadEducaciones(perfil.id),
      ]);

      this.experiencias.set(experiencias);
      this.educaciones.set(educaciones);
    } catch {
      this.loadError.set('No se pudo cargar tu perfil. Intenta recargar la página.');
    } finally {
      this.loading.set(false);
    }
  }

  updatePerfilField(field: PerfilField, value: string): void {
    this.perfil.update((current) => (current ? { ...current, [field]: value } : current));
  }

  async savePerfilField(field: PerfilField): Promise<void> {
    const current = this.perfil();
    if (!current) return;

    await this.runSave(`perfil.${field}`, async () => {
      await this.profileService.updatePerfil(current.id, { [field]: current[field] ?? '' });
    });
  }

  addExperiencia(): void {
    this.experiencias.update((items) => [
      ...items,
      {
        id: `temp-${crypto.randomUUID()}`,
        perfil_id: null,
        lugar: '',
        cargo: '',
        fecha_inicio: '',
        fecha_fin: null,
        descripcion: null,
        orden: items.length,
        metadata: null,
      },
    ]);
  }

  updateExperiencia(index: number, field: keyof ExperienciaMaestra, value: string | null): void {
    this.experiencias.update((items) =>
      items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  async saveExperiencia(index: number): Promise<void> {
    const perfil = this.perfil();
    if (!perfil) return;

    const item = this.experiencias()[index];
    if (!item?.lugar.trim() || !item.cargo.trim() || !item.fecha_inicio) return;

    const key = `exp.${item.id}`;
    await this.runSave(key, async () => {
      const saved = await this.profileService.upsertExperiencia(perfil.id, item, index);
      this.experiencias.update((items) => items.map((e, i) => (i === index ? saved : e)));
    });
  }

  async removeExperiencia(index: number): Promise<void> {
    const item = this.experiencias()[index];
    if (!item) return;

    const key = `exp.${item.id}`;
    await this.runSave(key, async () => {
      await this.profileService.deleteExperiencia(item.id);
      this.experiencias.update((items) => items.filter((_, i) => i !== index));
    });
  }

  addEducacion(): void {
    this.educaciones.update((items) => [
      ...items,
      {
        id: `temp-${crypto.randomUUID()}`,
        perfil_id: null,
        lugar: '',
        titulo: '',
        fecha_inicio: null,
        fecha_fin: null,
        nota: null,
        orden: items.length,
        metadata: null,
      },
    ]);
  }

  updateEducacion(index: number, field: keyof EducacionMaestra, value: string | null): void {
    this.educaciones.update((items) =>
      items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  async saveEducacion(index: number): Promise<void> {
    const perfil = this.perfil();
    if (!perfil) return;

    const item = this.educaciones()[index];
    if (!item?.lugar.trim() || !item.titulo.trim()) return;

    const key = `edu.${item.id}`;
    await this.runSave(key, async () => {
      const saved = await this.profileService.upsertEducacion(perfil.id, item, index);
      this.educaciones.update((items) => items.map((e, i) => (i === index ? saved : e)));
    });
  }

  async removeEducacion(index: number): Promise<void> {
    const item = this.educaciones()[index];
    if (!item) return;

    const key = `edu.${item.id}`;
    await this.runSave(key, async () => {
      await this.profileService.deleteEducacion(item.id);
      this.educaciones.update((items) => items.filter((_, i) => i !== index));
    });
  }

  fieldState(key: string): SaveState {
    return this.fieldStates()[key] ?? 'idle';
  }

  private async runSave(key: string, action: () => Promise<void>): Promise<void> {
    this.setFieldState(key, 'saving');

    try {
      await action();
      this.setFieldState(key, 'saved');
      setTimeout(() => {
        if (this.fieldStates()[key] === 'saved') {
          this.setFieldState(key, 'idle');
        }
      }, 2000);
    } catch {
      this.setFieldState(key, 'error');
    }
  }

  private setFieldState(key: string, state: SaveState): void {
    this.fieldStates.update((current) => ({ ...current, [key]: state }));
  }
}
