import type { CvLanguage, GeneratedCvDraft } from '../models/cv.models';

const SPANISH_MARKERS =
  /\b(ingeniería|actualidad|lenguajes de programación|educación|soy un|becario|misión|español|inglés|habilidades|experiencia|universidad|apoyo en|estudiante)\b/i;

const ENGLISH_MARKERS =
  /\b(engineering|present|programming languages|education|i am a|scholar|intern|english|skills|experience|university|supporting|student|about me)\b/i;

export function draftLanguageMismatch(draft: GeneratedCvDraft): string[] {
  const target = draft.language;
  const issues: string[] = [];
  const texts = collectDraftTexts(draft);

  for (const text of texts) {
    if (!text.trim()) continue;
    const looksSpanish = SPANISH_MARKERS.test(text);
    const looksEnglish = ENGLISH_MARKERS.test(text);

    if (target === 'en' && looksSpanish && !looksEnglish) {
      issues.push(`Contenido en español detectado: "${truncate(text)}"`);
    }
    if (target === 'es' && looksEnglish && !looksSpanish) {
      issues.push(`Contenido en inglés detectado: "${truncate(text)}"`);
    }
  }

  if (target === 'en' && draft.habilidadesLineas.some((l) => /lenguajes de programación/i.test(l))) {
    issues.push('Habilidades: usar prefijo "Programming languages:"');
  }
  if (target === 'es' && draft.habilidadesLineas.some((l) => /programming languages/i.test(l))) {
    issues.push('Habilidades: usar prefijo "Lenguajes de programación:"');
  }
  if (target === 'en' && draft.habilidadesLineas[2] && !/^languages:/i.test(draft.habilidadesLineas[2])) {
    issues.push('Habilidades línea 3: usar prefijo "Languages:"');
  }
  if (target === 'es' && draft.habilidadesLineas[2] && !/^idiomas:/i.test(draft.habilidadesLineas[2])) {
    issues.push('Habilidades línea 3: usar prefijo "Idiomas:"');
  }

  return issues;
}

function collectDraftTexts(draft: GeneratedCvDraft): string[] {
  return [
    draft.carrera,
    draft.sobreMi,
    ...draft.habilidadesLineas,
    ...draft.experiencias.flatMap((e) => [e.cargo, e.descripcion]),
    ...draft.educaciones.flatMap((e) => [e.titulo, e.nota]),
    ...draft.experiencias.map((e) => e.fechaFin),
  ];
}

function truncate(text: string, max = 60): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`;
}

export function presentLabel(language: CvLanguage): string {
  return language === 'es' ? 'Actualidad' : 'Present';
}
