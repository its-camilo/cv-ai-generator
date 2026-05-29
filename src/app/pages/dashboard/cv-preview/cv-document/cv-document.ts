import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { GeneratedCvDraft } from '../../../../core/models/cv.models';
import { pageTuneStyleVars } from '../../../../core/utils/cv-page-tune';

@Component({
  selector: 'app-cv-document',
  templateUrl: './cv-document.html',
  styleUrl: './cv-document.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CvDocument {
  readonly draft = input.required<GeneratedCvDraft>();
  readonly printRootId = input('cv-print-root');

  readonly pageTuneVars = computed(() => pageTuneStyleVars(this.draft().pageTune));

  formatFullName(draft: GeneratedCvDraft): string {
    return [draft.nombreLinea1, draft.nombreLinea2].filter(Boolean).join(' ').trim();
  }

  formatPhoneLine(draft: GeneratedCvDraft): string {
    const raw = draft.telefono.trim();
    if (!raw) return '';

    const digits = raw.replace(/\D/g, '');
    const localDigits =
      digits.startsWith('57') && digits.length > 10 ? digits.slice(2) : digits;

    if (draft.language === 'en') {
      const international = `+57 ${localDigits || raw.replace(/\D/g, '')}`;
      return `${draft.sectionLabels.telefono}: ${international}`;
    }

    const local = localDigits || raw.replace(/^\+57\s?/, '').trim();
    return `${draft.sectionLabels.telefono}: ${local}`;
  }

  formatExpDates(inicio: string, fin: string): string {
    if (!inicio && !fin) return '';
    if (!inicio) return fin;
    if (!fin) return inicio;
    return `${inicio}-${fin}`;
  }

  formatEduDates(inicio: string, fin: string): string {
    if (inicio && fin) return `${inicio}-${fin}`;
    return fin || inicio;
  }

  blockHeadline(lugar: string, titulo: string): { primary: string; secondary: string } {
    const place = lugar.trim();
    const title = titulo.trim();

    if (title.includes(' - ')) {
      const splitAt = title.indexOf(' - ');
      const primary = title.slice(0, splitAt).trim();
      const secondary = title.slice(splitAt + 3).trim();

      if (!place || primary.toLowerCase().includes(place.toLowerCase()) || place.toLowerCase().includes(primary.toLowerCase())) {
        return { primary, secondary };
      }
    }

    if (place && title) {
      return { primary: place, secondary: title };
    }

    return { primary: title || place, secondary: '' };
  }

  expBullets(descripcion: string): string[] {
    return descripcion
      .split(/\n+/)
      .map((line) => line.replace(/^[\s•●\-]+/, '').trim())
      .filter(Boolean);
  }
}
