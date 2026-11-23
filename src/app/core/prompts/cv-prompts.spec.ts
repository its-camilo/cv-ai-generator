import { describe, expect, it } from 'vitest';
import { buildDefaultPdfFileName, personNameSlug } from './cv-prompts';

describe('buildDefaultPdfFileName', () => {
  it('uses the profile name for any user', () => {
    expect(personNameSlug('María José García')).toBe('Maria_Jose_Garcia');
    expect(buildDefaultPdfFileName('Globant', 'Camilo Alejandro Lagos Malaver')).toBe(
      'Camilo_Alejandro_Lagos_Malaver_CV_Globant',
    );
  });
});