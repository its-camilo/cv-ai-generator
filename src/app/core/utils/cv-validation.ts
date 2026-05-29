import { CV_LAYOUT } from '../constants/cv-layout.constants';

export interface CvValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSobreMi(text: string): CvValidationResult {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const errors: string[] = [];

  if (trimmed.length < CV_LAYOUT.sobreMi.minChars) {
    errors.push(`Sobre mí muy corto (${trimmed.length}/${CV_LAYOUT.sobreMi.minChars} caracteres mín.)`);
  }
  if (trimmed.length > CV_LAYOUT.sobreMi.maxChars) {
    errors.push(`Sobre mí muy largo (${trimmed.length}/${CV_LAYOUT.sobreMi.maxChars} caracteres máx.)`);
  }
  if (words.length < CV_LAYOUT.sobreMi.minWords) {
    errors.push(`Sobre mí: pocas palabras (${words.length}/${CV_LAYOUT.sobreMi.minWords} mín.)`);
  }
  if (words.length > CV_LAYOUT.sobreMi.maxWords) {
    errors.push(`Sobre mí: demasiadas palabras (${words.length}/${CV_LAYOUT.sobreMi.maxWords} máx.)`);
  }

  const approxLines = Math.ceil(trimmed.length / CV_LAYOUT.sobreMi.charsPerLine);
  if (approxLines > CV_LAYOUT.sobreMi.maxLines) {
    errors.push(`Sobre mí ocuparía más de ${CV_LAYOUT.sobreMi.maxLines} líneas en el CV`);
  }

  return { valid: errors.length === 0, errors };
}

/** Ajusta sobre mí y habilidades al layout del PDF si hace falta. */
export function normalizeCvDraftSections(
  sobreMi: string,
  habilidadesLineas: string[],
): { sobreMi: string; habilidadesLineas: string[] } {
  let normalizedSobreMi = sobreMi.trim();
  let normalizedHabilidades = habilidadesLineas.map((l) => l.trim()).filter(Boolean);

  if (!validateSobreMi(normalizedSobreMi).valid) {
    normalizedSobreMi = fitSobreMiToLayout(normalizedSobreMi);
  }
  if (!validateHabilidadesLineas(normalizedHabilidades).valid) {
    normalizedHabilidades = fitHabilidadesToLayout(normalizedHabilidades);
  }

  return { sobreMi: normalizedSobreMi, habilidadesLineas: normalizedHabilidades };
}

export function validateHabilidadesLineas(lineas: string[]): CvValidationResult {
  const cleaned = lineas.map((l) => l.trim()).filter(Boolean);
  const errors: string[] = [];

  if (cleaned.length < CV_LAYOUT.habilidades.minLines) {
    errors.push(`Habilidades: se requieren al menos ${CV_LAYOUT.habilidades.minLines} líneas`);
  }
  if (cleaned.length > CV_LAYOUT.habilidades.exactLines) {
    errors.push(`Habilidades: máximo ${CV_LAYOUT.habilidades.exactLines} líneas`);
  }

  for (const [index, linea] of cleaned.entries()) {
    if (linea.length > CV_LAYOUT.habilidades.maxCharsPerLine) {
      errors.push(`Habilidades línea ${index + 1}: excede ${CV_LAYOUT.habilidades.maxCharsPerLine} caracteres`);
    }
  }

  const total = cleaned.join(' ').length;
  if (total < CV_LAYOUT.habilidades.minTotalChars) {
    errors.push('Habilidades: contenido total insuficiente');
  }
  if (total > CV_LAYOUT.habilidades.maxTotalChars) {
    errors.push(`Habilidades: contenido total excede ${CV_LAYOUT.habilidades.maxTotalChars} caracteres`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateCvDraftSections(sobreMi: string, habilidadesLineas: string[]): CvValidationResult {
  const sobre = validateSobreMi(sobreMi);
  const hab = validateHabilidadesLineas(habilidadesLineas);
  return {
    valid: sobre.valid && hab.valid,
    errors: [...sobre.errors, ...hab.errors],
  };
}

/** Recorta sobre mí al límite sin cortar palabras (último recurso). */
export function fitSobreMiToLayout(text: string): string {
  let trimmed = text.trim();
  if (trimmed.length <= CV_LAYOUT.sobreMi.maxChars) return trimmed;

  const limit = CV_LAYOUT.sobreMi.maxChars;
  trimmed = trimmed.slice(0, limit);
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace > CV_LAYOUT.sobreMi.minChars) {
    trimmed = trimmed.slice(0, lastSpace);
  }
  return trimmed.trim();
}

/** Ajusta líneas de habilidades al límite por línea (último recurso). */
export function fitHabilidadesToLayout(lineas: string[]): string[] {
  return lineas
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, CV_LAYOUT.habilidades.exactLines)
    .map((linea) =>
      linea.length > CV_LAYOUT.habilidades.maxCharsPerLine ?
        linea.slice(0, CV_LAYOUT.habilidades.maxCharsPerLine).replace(/\s+\S*$/, '').trim()
      : linea,
    );
}
