import { CV_LAYOUT, CV_SECTION_LABELS } from '../constants/cv-layout.constants';
import type { CvEducationItem, CvExperienceItem, CvLanguage } from '../models/cv.models';

const BASE_SYSTEM = `Eres un experto en redacción de CVs optimizados para ATS (Applicant Tracking Systems).
Usa vocabulario claro, sin adornos, sin emojis, sin markdown.
Responde ÚNICAMENTE con JSON válido, sin texto adicional ni bloques de código.`;

export function empresaPrompt(oferta: string, language: CvLanguage): { system: string; user: string } {
  return {
    system: BASE_SYSTEM,
    user: `Analiza esta oferta laboral y extrae el nombre corto de la empresa o institución contratante.
Idioma de salida para el slug: inglés (solo ASCII, sin espacios).
Responde JSON: {"empresa":"NombreCorto"}

Oferta:
${oferta}`,
  };
}

export function sobreMiPrompt(
  language: CvLanguage,
  sobreMiLargo: string,
  carrera: string,
  oferta: string,
  options?: {
    validationErrors?: string[];
    strictLevel?: number;
    previousAttempt?: string;
  },
): { system: string; user: string } {
  const langLabel = language === 'es' ? 'español' : 'inglés';
  const strictLevel = options?.strictLevel ?? 0;
  const validationErrors = options?.validationErrors ?? [];

  const strictNote =
    strictLevel > 0 ?
      `\n\nNIVEL DE EXIGENCIA ${strictLevel}/${CV_LAYOUT.validationMaxAttempts}: FALLASTE el límite. Sé MÁS BREVE. Prioriza 2 frases cortas si hace falta.`
    : '';

  const retry =
    validationErrors.length ?
      `\n\nCORRECCIÓN OBLIGATORIA — cumple EXACTAMENTE:\n${validationErrors.map((e) => `- ${e}`).join('\n')}`
    : '';

  const previous =
    options?.previousAttempt ?
      `\n\nTu intento anterior (RECHAZADO por exceder límites):\n"${options.previousAttempt}"\nLongitud: ${options.previousAttempt.length} caracteres. DEBE ser ≤ ${CV_LAYOUT.sobreMi.maxChars}.`
    : '';

  return {
    system: `${BASE_SYSTEM}
El párrafo debe caber en MÁXIMO 2 líneas impresas (Arial 10pt, ancho carta US Letter).
Límite ABSOLUTO: ${CV_LAYOUT.sobreMi.minChars}-${CV_LAYOUT.sobreMi.maxChars} caracteres (incluye espacios), ${CV_LAYOUT.sobreMi.minWords}-${CV_LAYOUT.sobreMi.maxWords} palabras.
NO superes ${CV_LAYOUT.sobreMi.maxChars} caracteres bajo ninguna circunstancia.
Tono profesional, primera persona, orientado a la oferta pero fiel al perfil.${strictNote}`,
    user: `Genera el párrafo "Sobre mí" para un CV en ${langLabel}, adaptado a la oferta.
Responde JSON: {"sobreMi":"..."}

Perfil base (inventario):
${sobreMiLargo || '(vacío)'}

Carrera: ${carrera || 'N/A'}

Oferta laboral:
${oferta}${previous}${retry}`,
  };
}

export function habilidadesPrompt(
  language: CvLanguage,
  habilidadesLargo: string,
  oferta: string,
  options?: {
    validationErrors?: string[];
    strictLevel?: number;
    previousAttempt?: string[];
  },
): { system: string; user: string } {
  const langLabel = language === 'es' ? 'español' : 'inglés';
  const strictLevel = options?.strictLevel ?? 0;
  const validationErrors = options?.validationErrors ?? [];

  const strictNote =
    strictLevel > 0 ?
      `\n\nNIVEL DE EXIGENCIA ${strictLevel}/${CV_LAYOUT.validationMaxAttempts}: acorta líneas. Elimina lo menos relevante.`
    : '';

  const retry =
    validationErrors.length ?
      `\n\nCORRECCIÓN OBLIGATORIA:\n${validationErrors.map((e) => `- ${e}`).join('\n')}`
    : '';

  const previous =
    options?.previousAttempt?.length ?
      `\n\nIntento anterior (RECHAZADO):\n${options.previousAttempt.map((l, i) => `${i + 1}. ${l} (${l.length} chars)`).join('\n')}`
    : '';

  return {
    system: `${BASE_SYSTEM}
Selecciona las habilidades MÁS relevantes para la oferta desde el inventario del candidato.
Formato EXACTO: array de EXACTAMENTE 3 strings (líneas), estilo CV ATS:
- Línea 1: habilidades/herramientas/metodologías relevantes separadas por " - " (sin prefijo)
- Línea 2: prefijo "${language === 'es' ? 'Lenguajes de programación:' : 'Programming languages:'}" seguido de lenguajes separados por " - "
- Línea 3: prefijo "${language === 'es' ? 'Idiomas:' : 'Languages:'}" seguido de idiomas y niveles separados por " - "
Cada línea MÁXIMO ${CV_LAYOUT.habilidades.maxCharsPerLine} caracteres. Total MÁXIMO ${CV_LAYOUT.habilidades.maxTotalChars} caracteres.${strictNote}`,
    user: `Genera la sección Habilidades en ${langLabel} para esta oferta.
Responde JSON: {"habilidades":["linea1","linea2","linea3"]}

Inventario completo de habilidades:
${habilidadesLargo || '(vacío)'}

Oferta laboral:
${oferta}${previous}${retry}`,
  };
}

export interface LocalizedCvContent {
  carrera: string;
  sobreMi: string;
  habilidades: string[];
  experiencias: CvExperienceItem[];
  educaciones: CvEducationItem[];
}

export function localizeCvContentPrompt(
  language: CvLanguage,
  content: LocalizedCvContent,
  issues?: string[],
): { system: string; user: string } {
  const langLabel = language === 'es' ? 'español' : 'inglés';
  const labels = CV_SECTION_LABELS[language];
  const issueBlock =
    issues?.length ?
      `\n\nPROBLEMAS DETECTADOS — corrígelos:\n${issues.map((i) => `- ${i}`).join('\n')}`
    : '';

  return {
    system: `${BASE_SYSTEM}
Plantilla de referencia: CV de 1 página, Arial 10pt, secciones ${labels.sobreMi}, ${labels.experiencia}, ${labels.educacion}, ${labels.habilidades}.
TODO el texto visible del CV debe estar en ${langLabel}.
NO traduzcas: nombres propios de personas, URLs, correos, teléfonos, fechas (MM/YYYY), nombres oficiales de instituciones/empresas.
SÍ traduce: carrera/título profesional, cargos, descripciones, títulos académicos/programas, notas (ej. GPA), prefijos de habilidades, "Actualidad"/"Present", niveles de idioma.
Habilidades: exactamente 3 líneas.
- Línea 1: herramientas/metodologías sin prefijo.
- Línea 2: prefijo "${language === 'es' ? 'Lenguajes de programación:' : 'Programming languages:'}".
- Línea 3: prefijo "${language === 'es' ? 'Idiomas:' : 'Languages:'}".
Mantén la estructura JSON y el significado profesional.`,
    user: `Verifica y localiza este borrador de CV al ${langLabel}. Si algo ya está en el idioma correcto, déjalo igual.
Responde JSON:
{
  "carrera":"...",
  "sobreMi":"...",
  "habilidades":["linea1","linea2","linea3"],
  "experiencias":[{"lugar":"...","cargo":"...","fechaInicio":"...","fechaFin":"...","descripcion":"..."}],
  "educaciones":[{"lugar":"...","titulo":"...","fechaInicio":"...","fechaFin":"...","nota":"..."}]
}

Contenido actual:
${JSON.stringify(content, null, 2)}${issueBlock}`,
  };
}

export function parseLocalizedCvContent(raw: string): LocalizedCvContent {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  return {
    carrera: String(parsed['carrera'] ?? ''),
    sobreMi: String(parsed['sobreMi'] ?? ''),
    habilidades: Array.isArray(parsed['habilidades']) ?
      (parsed['habilidades'] as unknown[]).map(String)
    : [],
    experiencias: Array.isArray(parsed['experiencias']) ?
      (parsed['experiencias'] as CvExperienceItem[])
    : [],
    educaciones: Array.isArray(parsed['educaciones']) ?
      (parsed['educaciones'] as CvEducationItem[])
    : [],
  };
}

export function refineSobreMiPrompt(
  language: CvLanguage,
  current: string,
  instruction: string,
): { system: string; user: string } {
  const langLabel = language === 'es' ? 'español' : 'inglés';
  return {
    system: `${BASE_SYSTEM}
Mantén ${CV_LAYOUT.sobreMi.minChars}-${CV_LAYOUT.sobreMi.maxChars} caracteres para caber en 1 página.`,
    user: `Modifica este párrafo "Sobre mí" en ${langLabel} según la instrucción del usuario.
Responde JSON: {"sobreMi":"..."}

Texto actual:
${current}

Instrucción:
${instruction}`,
  };
}

export function refineHabilidadesPrompt(
  language: CvLanguage,
  currentLines: string[],
  instruction: string,
): { system: string; user: string } {
  const langLabel = language === 'es' ? 'español' : 'inglés';
  return {
    system: `${BASE_SYSTEM}
Exactamente 3 líneas, máximo ${CV_LAYOUT.habilidades.maxCharsPerLine} caracteres por línea.
Línea 1: habilidades/herramientas sin prefijo.
Línea 2: "${language === 'es' ? 'Lenguajes de programación:' : 'Programming languages:'}" + lenguajes.
Línea 3: "${language === 'es' ? 'Idiomas:' : 'Languages:'}" + idiomas y niveles.`,
    user: `Modifica estas habilidades en ${langLabel} según la instrucción.
Responde JSON: {"habilidades":["linea1","linea2","linea3"]}

Líneas actuales:
${currentLines.join('\n')}

Instrucción:
${instruction}`,
  };
}

export function parseJsonField<T>(raw: string, field: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  if (!(field in parsed)) {
    throw new Error(`Respuesta IA sin campo "${field}"`);
  }
  return parsed[field] as T;
}

export function slugifyEmpresa(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'Empresa';
}

export function buildDefaultPdfFileName(empresaSlug: string): string {
  return `Camilo_Lagos_CV_${empresaSlug}`;
}

export function splitNombreCompleto(nombreCompleto: string): { linea1: string; linea2: string } {
  const parts = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) {
    return { linea1: parts[0] ?? '', linea2: parts.slice(1).join(' ') };
  }
  return {
    linea1: parts.slice(0, -1).join(' '),
    linea2: parts.at(-1) ?? '',
  };
}

export function extractGithubUrl(portafolioUrl: string | null, explicit?: string): string {
  if (explicit?.trim()) return explicit.trim();
  if (portafolioUrl?.includes('github.com')) return portafolioUrl;
  return 'https://github.com/its-camilo';
}
