export interface PerfilMaestro {
  id: string;
  user_id: string | null;
  nombre_completo: string;
  carrera: string | null;
  ubicacion: string | null;
  telefono: string | null;
  correo: string | null;
  portafolio_url: string | null;
  sobre_mi_largo: string | null;
  habilidades_largo: string | null;
  created_at: string | null;
}

export interface ExperienciaMaestra {
  id: string;
  perfil_id: string | null;
  lugar: string;
  cargo: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  descripcion: string | null;
  orden: number | null;
  metadata: Record<string, unknown> | null;
}

export interface EducacionMaestra {
  id: string;
  perfil_id: string | null;
  lugar: string;
  titulo: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  nota: string | null;
  orden: number | null;
  metadata: Record<string, unknown> | null;
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
