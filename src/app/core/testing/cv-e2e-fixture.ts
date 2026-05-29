import { CV_SECTION_LABELS } from '../constants/cv-layout.constants';
import type { GeneratedCvDraft } from '../models/cv.models';
import { DEFAULT_CV_PAGE_TUNE } from '../utils/cv-page-tune';

/** Borrador EN realista para pruebas de layout (convocatoria AI Lead Globant). */
export function createGlobantAiLeadE2eDraft(): GeneratedCvDraft {
  return {
    language: 'en',
    ofertaTexto: 'AI Lead - Globant Barcelona',
    empresaSlug: 'Globant',
    pdfFileName: 'Camilo_Lagos_CV_Globant',
    nombreLinea1: 'Camilo Alejandro Lagos',
    nombreLinea2: 'Malaver',
    carrera: 'Systems and Computing Engineering',
    ubicacion: 'Bogota, Colombia',
    telefono: '+57 3046753264',
    correo: 'camiloalejandrolagosmalaver@gmail.com',
    portafolioUrl: 'https://its-camilo.github.io/portfolio/',
    githubUrl: 'https://github.com/its-camilo',
    sobreMi:
      'Systems and Computing Engineering student passionate about software engineering and AI. I build production-oriented solutions with Python, MLOps practices, and modern LLM stacks. Seeking an AI Lead role to deliver scalable GenAI products in enterprise environments.',
    experiencias: [
      {
        lugar: 'Universidad Nacional de Colombia',
        cargo: 'Teaching Assistant',
        fechaInicio: '11/2024',
        fechaFin: 'Present',
        descripcion:
          'Support exam grading and personalized student mentoring, contributing to academic quality and learning outcomes.',
      },
    ],
    educaciones: [
      {
        lugar: 'MinTIC',
        titulo: 'Mision TIC',
        fechaInicio: '2021',
        fechaFin: '2021',
        nota: '',
      },
      {
        lugar: 'Universidad Nacional de Colombia',
        titulo: 'Systems and Computing Engineering',
        fechaInicio: '02/2022',
        fechaFin: 'Present',
        nota: 'GPA 4.5/5.0',
      },
    ],
    habilidadesLineas: [
      'SCRUM - SOLID Principles - MLOps - AI Architecture',
      'Programming languages: Python - JavaScript - Java - C#',
      'Languages: English (Professional) - Spanish (Native)',
    ],
    sectionLabels: { ...CV_SECTION_LABELS.en },
    pageTune: { ...DEFAULT_CV_PAGE_TUNE },
  };
}
