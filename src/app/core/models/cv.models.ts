export type CvLanguage = 'es' | 'en';

export interface CvExperienceItem {
  lugar: string;
  cargo: string;
  fechaInicio: string;
  fechaFin: string;
  descripcion: string;
}

export interface CvEducationItem {
  lugar: string;
  titulo: string;
  fechaInicio: string;
  fechaFin: string;
  nota: string;
}

export interface CvSectionLabels {
  sobreMi: string;
  experiencia: string;
  educacion: string;
  habilidades: string;
  portafolio: string;
  github: string;
  telefono: string;
  correo: string;
  lenguajesProgramacion: string;
  idiomas: string;
}

export interface CvPageTune {
  gapScale: number;
  lineHeightScale: number;
  fontScale: number;
  fillPage: boolean;
}

export interface GeneratedCvDraft {
  language: CvLanguage;
  ofertaTexto: string;
  empresaSlug: string;
  pdfFileName: string;
  nombreLinea1: string;
  nombreLinea2: string;
  carrera: string;
  ubicacion: string;
  telefono: string;
  correo: string;
  portafolioUrl: string;
  githubUrl: string;
  sobreMi: string;
  experiencias: CvExperienceItem[];
  educaciones: CvEducationItem[];
  habilidadesLineas: string[];
  sectionLabels: CvSectionLabels;
  pageTune: CvPageTune;
}

export type CvGenerationPhase =
  | 'idle'
  | 'loading-profile'
  | 'generating-empresa'
  | 'generating-sobre-mi'
  | 'generating-habilidades'
  | 'localizing'
  | 'tuning-layout'
  | 'validating'
  | 'done'
  | 'error';
