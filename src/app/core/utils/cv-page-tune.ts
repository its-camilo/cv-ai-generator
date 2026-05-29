import { CV_LAYOUT } from '../constants/cv-layout.constants';
import type { CvPageTune, GeneratedCvDraft } from '../models/cv.models';

export const DEFAULT_CV_PAGE_TUNE: CvPageTune = {
  gapScale: 1,
  lineHeightScale: 1,
  fontScale: 1,
  fillPage: true,
};

const PT_PER_IN = 72;
const PX_PER_IN = 96;

const TUNE_LIMITS = {
  gapScale: { min: 0.55, max: 2.4 },
  lineHeightScale: { min: 1.0, max: 1.28 },
  fontScale: { min: 0.9, max: 1.08 },
  fillRatioMin: 0.88,
} as const;

export function getUsablePageHeightIn(): number {
  const { heightIn, paddingTopIn, paddingBottomIn } = CV_LAYOUT.page;
  const topBarIn = CV_LAYOUT.theme.topBarHeightPx / PX_PER_IN;
  return heightIn - paddingTopIn - paddingBottomIn - topBarIn;
}

export interface PageOverflowMetrics {
  overflows: boolean;
  innerHeightPx: number;
  contentHeightPx: number;
}

function ptIn(pt: number): number {
  return pt / PT_PER_IN;
}

function countTextLines(text: string, charsPerLine: number): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.ceil(trimmed.length / charsPerLine);
}

function scaledPt(basePt: number, fontScale: number): number {
  return basePt * fontScale;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampTune(tune: CvPageTune): CvPageTune {
  return {
    gapScale: clamp(tune.gapScale, TUNE_LIMITS.gapScale.min, TUNE_LIMITS.gapScale.max),
    lineHeightScale: clamp(
      tune.lineHeightScale,
      TUNE_LIMITS.lineHeightScale.min,
      TUNE_LIMITS.lineHeightScale.max,
    ),
    fontScale: clamp(tune.fontScale, TUNE_LIMITS.fontScale.min, TUNE_LIMITS.fontScale.max),
    fillPage: tune.fillPage,
  };
}

function shrinkTune(tune: CvPageTune): CvPageTune {
  const next = { ...tune };
  if (next.gapScale > TUNE_LIMITS.gapScale.min) {
    next.gapScale -= 0.05;
  } else if (next.lineHeightScale > TUNE_LIMITS.lineHeightScale.min) {
    next.lineHeightScale -= 0.012;
  } else if (next.fontScale > TUNE_LIMITS.fontScale.min) {
    next.fontScale -= 0.006;
  }
  return clampTune(next);
}

function expandTune(tune: CvPageTune): CvPageTune {
  const next = { ...tune };
  if (next.gapScale < TUNE_LIMITS.gapScale.max) {
    next.gapScale += 0.04;
  } else if (next.lineHeightScale < TUNE_LIMITS.lineHeightScale.max) {
    next.lineHeightScale += 0.01;
  } else if (next.fontScale < TUNE_LIMITS.fontScale.max) {
    next.fontScale += 0.004;
  }
  return clampTune(next);
}

function tuneChanged(before: CvPageTune, after: CvPageTune): boolean {
  return (
    before.gapScale !== after.gapScale ||
    before.lineHeightScale !== after.lineHeightScale ||
    before.fontScale !== after.fontScale
  );
}

/** Estima la altura del contenido en pulgadas para un borrador y tune dados. */
export function estimateDraftHeightIn(draft: GeneratedCvDraft, tune: CvPageTune): number {
  const bodyPt = scaledPt(CV_LAYOUT.typography.bodyPt, tune.fontScale);
  const bodyLineIn = ptIn(bodyPt * CV_LAYOUT.typography.lineHeight * tune.lineHeightScale);
  const sectionGapIn = ptIn(bodyPt * 0.55 * tune.gapScale);
  const blockGapIn = ptIn(bodyPt * 0.28 * tune.gapScale);
  const headerGapIn = ptIn(bodyPt * 0.4 * tune.gapScale);
  const titleLineIn = (pt: number) => ptIn(scaledPt(pt, tune.fontScale) * 1.2);

  let heightIn = CV_LAYOUT.theme.topBarHeightPx / PX_PER_IN + ptIn(bodyPt * 0.35 * tune.gapScale);

  heightIn += 2 * titleLineIn(CV_LAYOUT.typography.namePt);
  if (draft.carrera) {
    heightIn += titleLineIn(CV_LAYOUT.typography.subtitlePt);
  }

  const contactLines = [
    draft.ubicacion,
    draft.telefono,
    draft.correo,
    draft.portafolioUrl,
    draft.githubUrl,
  ].filter((line) => line.trim());
  heightIn += contactLines.length * ptIn(scaledPt(CV_LAYOUT.typography.contactPt, tune.fontScale) * 1.3);
  heightIn += headerGapIn;

  heightIn += sectionGapIn + titleLineIn(CV_LAYOUT.typography.sectionTitlePt);
  heightIn += countTextLines(draft.sobreMi, CV_LAYOUT.sobreMi.charsPerLine) * bodyLineIn;

  if (draft.experiencias.length > 0) {
    heightIn += sectionGapIn + titleLineIn(CV_LAYOUT.typography.sectionTitlePt);
    for (const exp of draft.experiencias) {
      heightIn += titleLineIn(CV_LAYOUT.typography.bodyPt);
      heightIn += ptIn(scaledPt(9, tune.fontScale));
      heightIn += countTextLines(exp.descripcion, CV_LAYOUT.sobreMi.charsPerLine) * bodyLineIn;
      heightIn += blockGapIn;
    }
  }

  if (draft.educaciones.length > 0) {
    heightIn += sectionGapIn + titleLineIn(CV_LAYOUT.typography.sectionTitlePt);
    for (const edu of draft.educaciones) {
      heightIn += titleLineIn(CV_LAYOUT.typography.bodyPt);
      if (edu.fechaInicio || edu.fechaFin) {
        heightIn += ptIn(scaledPt(9, tune.fontScale));
      }
      if (edu.nota.trim()) {
        heightIn += bodyLineIn;
      }
      heightIn += blockGapIn;
    }
  }

  if (draft.habilidadesLineas.length > 0) {
    heightIn += sectionGapIn + titleLineIn(CV_LAYOUT.typography.sectionTitlePt);
    heightIn += draft.habilidadesLineas.filter(Boolean).length * bodyLineIn;
  }

  return heightIn;
}

export function draftFitsPage(draft: GeneratedCvDraft, tune: CvPageTune): boolean {
  return estimateDraftHeightIn(draft, tune) <= getUsablePageHeightIn();
}

/** Calcula tune que cabe en 1 página y luego expande sin desbordar. */
export function computePageTune(draft: GeneratedCvDraft): CvPageTune {
  const targetIn = getUsablePageHeightIn();
  let tune = clampTune({ ...DEFAULT_CV_PAGE_TUNE });

  for (let i = 0; i < 80; i++) {
    if (estimateDraftHeightIn(draft, tune) <= targetIn) break;
    const next = shrinkTune(tune);
    if (!tuneChanged(tune, next)) break;
    tune = next;
  }

  for (let i = 0; i < 80; i++) {
    const heightIn = estimateDraftHeightIn(draft, tune);
    if (heightIn >= targetIn * TUNE_LIMITS.fillRatioMin) break;

    const next = expandTune(tune);
    if (!tuneChanged(tune, next)) break;
    if (estimateDraftHeightIn(draft, next) > targetIn) break;
    tune = next;
  }

  return tune;
}

export function pageTuneStyleVars(tune: CvPageTune | undefined): Record<string, string> {
  const t = tune ?? DEFAULT_CV_PAGE_TUNE;
  return {
    '--cv-tune-gap': String(t.gapScale),
    '--cv-tune-leading': String(t.lineHeightScale),
    '--cv-tune-font': String(t.fontScale),
  };
}

export function getPageInnerHeightPx(docElement: HTMLElement): number {
  const style = getComputedStyle(docElement);
  const paddingTop = Number.parseFloat(style.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
  return docElement.clientHeight - paddingTop - paddingBottom;
}

export function measurePageOverflow(docElement: HTMLElement): PageOverflowMetrics {
  const sheet = docElement.querySelector('.cv-doc__sheet') as HTMLElement | null;
  const innerHeightPx = getPageInnerHeightPx(docElement);
  const contentHeightPx = sheet?.scrollHeight ?? docElement.scrollHeight;
  return {
    overflows: contentHeightPx > innerHeightPx + 1,
    innerHeightPx,
    contentHeightPx,
  };
}

/** Ajuste fino midiendo el DOM: prioridad absoluta = sin overflow. */
export function refinePageTuneFromElement(
  _draft: GeneratedCvDraft,
  docElement: HTMLElement,
  tune: CvPageTune,
): CvPageTune {
  const sheet = docElement.querySelector('.cv-doc__sheet') as HTMLElement | null;
  if (!sheet) return tune;

  let current = clampTune({ ...tune });

  const measure = (): PageOverflowMetrics => {
    applyPageTuneStyles(docElement, current);
    return measurePageOverflow(docElement);
  };

  for (let i = 0; i < 40; i++) {
    const { overflows } = measure();
    if (!overflows) break;
    const next = shrinkTune(current);
    if (!tuneChanged(current, next)) break;
    current = next;
  }

  for (let i = 0; i < 40; i++) {
    const metrics = measure();
    if (metrics.overflows) break;
    if (metrics.contentHeightPx >= metrics.innerHeightPx * TUNE_LIMITS.fillRatioMin) break;

    const next = expandTune(current);
    if (!tuneChanged(current, next)) break;

    applyPageTuneStyles(docElement, next);
    const trial = measurePageOverflow(docElement);
    if (trial.overflows) {
      applyPageTuneStyles(docElement, current);
      break;
    }
    current = next;
  }

  applyPageTuneStyles(docElement, current);
  return current;
}

export function applyPageTuneStyles(docElement: HTMLElement, tune: CvPageTune): void {
  const vars = pageTuneStyleVars(tune);
  for (const [key, value] of Object.entries(vars)) {
    docElement.style.setProperty(key, value);
  }
}
