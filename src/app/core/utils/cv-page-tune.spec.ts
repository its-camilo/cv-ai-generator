import { describe, expect, it } from 'vitest';
import { CV_SECTION_LABELS } from '../constants/cv-layout.constants';
import type { GeneratedCvDraft } from '../models/cv.models';
import { createGlobantAiLeadE2eDraft } from '../testing/cv-e2e-fixture';
import {
  computePageTune,
  DEFAULT_CV_PAGE_TUNE,
  draftFitsPage,
  estimateDraftHeightIn,
  getUsablePageHeightIn,
} from './cv-page-tune';

describe('cv-page-tune', () => {
  const draft = createGlobantAiLeadE2eDraft();

  it('Globant EN fixture fits page after computePageTune', () => {
    const tune = computePageTune(draft);
    expect(draftFitsPage(draft, tune)).toBe(true);
    expect(estimateDraftHeightIn(draft, tune)).toBeLessThanOrEqual(getUsablePageHeightIn() + 0.001);
  });

  it('never exceeds usable height when expanding from default tune', () => {
    let tune = { ...DEFAULT_CV_PAGE_TUNE };
    for (let i = 0; i < 100; i++) {
      tune = computePageTune({ ...draft, pageTune: tune });
      expect(draftFitsPage(draft, tune)).toBe(true);
      if (tune.gapScale >= 2.4) break;
    }
  });

  it('handles long sobre mí without overflow estimate', () => {
    const longDraft: GeneratedCvDraft = {
      ...draft,
      sobreMi: 'A'.repeat(310),
      sectionLabels: { ...CV_SECTION_LABELS.en },
    };
    const tune = computePageTune(longDraft);
    expect(draftFitsPage(longDraft, tune)).toBe(true);
  });
});
