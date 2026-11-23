import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GeneratedCvDraft } from '../../src/app/core/models/cv.models.js';
import { pageTuneStyleVars } from '../../src/app/core/utils/cv-page-tune.js';
import { sanitizeEducationNota } from '../../src/app/core/utils/cv-validation.js';

const cvCss = readFileSync(
  join(process.cwd(), 'src/app/pages/dashboard/cv-preview/cv-document/cv-document.css'),
  'utf8',
).replace(':host { display: block; }', '');

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFullName(draft: GeneratedCvDraft): string {
  return [draft.nombreLinea1, draft.nombreLinea2].filter(Boolean).join(' ').trim();
}

function formatPhoneLine(draft: GeneratedCvDraft): string {
  const raw = draft.telefono.trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  const localDigits = digits.startsWith('57') && digits.length > 10 ? digits.slice(2) : digits;
  if (draft.language === 'en') {
    return `${draft.sectionLabels.telefono}: +57 ${localDigits || raw.replace(/\D/g, '')}`;
  }
  const local = localDigits || raw.replace(/^\+57\s?/, '').trim();
  return `${draft.sectionLabels.telefono}: ${local}`;
}

function formatExpDates(inicio: string, fin: string): string {
  if (!inicio && !fin) return '';
  if (!inicio) return fin;
  if (!fin) return inicio;
  return `${inicio}-${fin}`;
}

function formatEduDates(inicio: string, fin: string): string {
  if (inicio && fin) return `${inicio}-${fin}`;
  return fin || inicio;
}

function blockHeadline(lugar: string, titulo: string): { primary: string; secondary: string } {
  const place = lugar.trim();
  const title = titulo.trim();
  if (title.includes(' - ')) {
    const splitAt = title.indexOf(' - ');
    const primary = title.slice(0, splitAt).trim();
    const secondary = title.slice(splitAt + 3).trim();
    if (
      !place ||
      primary.toLowerCase().includes(place.toLowerCase()) ||
      place.toLowerCase().includes(primary.toLowerCase())
    ) {
      return { primary, secondary };
    }
  }
  if (place && title) return { primary: place, secondary: title };
  return { primary: title || place, secondary: '' };
}

function expBullets(descripcion: string): string[] {
  return descripcion
    .split(/\n+/)
    .map((line) => line.replace(/^[\s•●\-]+/, '').trim())
    .filter(Boolean);
}

export function renderCvHtml(draft: GeneratedCvDraft): string {
  const tuneVars = pageTuneStyleVars(draft.pageTune);
  const styleAttr = Object.entries(tuneVars)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');

  const headerParts: string[] = [];
  const fullName = formatFullName(draft);
  headerParts.push(`<h1 class="cv-doc__name">${escapeHtml(fullName)}</h1>`);
  if (draft.carrera) {
    headerParts.push(`<p class="cv-doc__carrera">${escapeHtml(draft.carrera)}</p>`);
  }
  if (draft.ubicacion) {
    headerParts.push(`<p class="cv-doc__contact-line">${escapeHtml(draft.ubicacion)}</p>`);
  }
  const phone = formatPhoneLine(draft);
  if (phone) headerParts.push(`<p class="cv-doc__contact-line">${escapeHtml(phone)}</p>`);
  if (draft.correo) {
    headerParts.push(
      `<p class="cv-doc__contact-line">${escapeHtml(draft.sectionLabels.correo)}: <a class="cv-doc__link" href="mailto:${escapeHtml(draft.correo)}">${escapeHtml(draft.correo)}</a></p>`,
    );
  }
  if (draft.portafolioUrl) {
    headerParts.push(
      `<p class="cv-doc__contact-line">${escapeHtml(draft.sectionLabels.portafolio)}: <a class="cv-doc__link" href="${escapeHtml(draft.portafolioUrl)}">${escapeHtml(draft.portafolioUrl)}</a></p>`,
    );
  }
  if (draft.githubUrl) {
    headerParts.push(
      `<p class="cv-doc__contact-line">${escapeHtml(draft.sectionLabels.github)}: <a class="cv-doc__link" href="${escapeHtml(draft.githubUrl)}">${escapeHtml(draft.githubUrl)}</a></p>`,
    );
  }

  let sections = '';
  sections += `<section class="cv-doc__section cv-doc__section--first"><h2 class="cv-doc__section-title">${escapeHtml(draft.sectionLabels.sobreMi)}</h2><p class="cv-doc__sobre">${escapeHtml(draft.sobreMi)}</p></section>`;

  if (draft.experiencias.length > 0) {
    let blocks = '';
    for (const exp of draft.experiencias) {
      blocks += `<div class="cv-doc__block"><p class="cv-doc__block-head"><strong class="cv-doc__block-primary">${escapeHtml(exp.lugar)}</strong>`;
      if (exp.cargo) {
        blocks += `<span class="cv-doc__block-secondary"> - ${escapeHtml(exp.cargo)}</span>`;
      }
      blocks += '</p>';
      const dates = formatExpDates(exp.fechaInicio, exp.fechaFin);
      if (dates) blocks += `<p class="cv-doc__block-dates">${escapeHtml(dates)}</p>`;
      for (const bullet of expBullets(exp.descripcion)) {
        blocks += `<p class="cv-doc__bullet">● ${escapeHtml(bullet)}</p>`;
      }
      blocks += '</div>';
    }
    sections += `<section class="cv-doc__section"><h2 class="cv-doc__section-title">${escapeHtml(draft.sectionLabels.experiencia)}</h2>${blocks}</section>`;
  }

  if (draft.educaciones.length > 0) {
    let blocks = '';
    for (const edu of draft.educaciones) {
      const head = blockHeadline(edu.lugar, edu.titulo);
      blocks += '<div class="cv-doc__block">';
      if (head.primary) {
        blocks += `<p class="cv-doc__block-head"><strong class="cv-doc__block-primary">${escapeHtml(head.primary)}</strong>`;
        if (head.secondary) {
          blocks += `<span class="cv-doc__block-secondary"> - ${escapeHtml(head.secondary)}</span>`;
        }
        blocks += '</p>';
      }
      const dates = formatEduDates(edu.fechaInicio, edu.fechaFin);
      if (dates) blocks += `<p class="cv-doc__block-dates">${escapeHtml(dates)}</p>`;
      const nota = sanitizeEducationNota(edu.nota);
      if (nota) blocks += `<p class="cv-doc__block-note">${escapeHtml(nota)}</p>`;
      blocks += '</div>';
    }
    sections += `<section class="cv-doc__section"><h2 class="cv-doc__section-title">${escapeHtml(draft.sectionLabels.educacion)}</h2>${blocks}</section>`;
  }

  if (draft.habilidadesLineas.length > 0) {
    const lines = draft.habilidadesLineas
      .map((linea) => `<p class="cv-doc__skill-line">${escapeHtml(linea)}</p>`)
      .join('');
    sections += `<section class="cv-doc__section cv-doc__section--skills"><h2 class="cv-doc__section-title">${escapeHtml(draft.sectionLabels.habilidades)}</h2>${lines}</section>`;
  }

  const fillClass = draft.pageTune.fillPage ? ' cv-doc__sections--fill' : '';

  return `<!DOCTYPE html>
<html lang="${draft.language}">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; }
    ${cvCss}
  </style>
</head>
<body>
  <article class="cv-doc" style="${styleAttr}">
    <div class="cv-doc__sheet">
      <div class="cv-doc__top-bar" aria-hidden="true"></div>
      <div class="cv-doc__content">
        <header class="cv-doc__header">${headerParts.join('')}</header>
        <div class="cv-doc__sections${fillClass}">${sections}</div>
      </div>
    </div>
  </article>
</body>
</html>`;
}