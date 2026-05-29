import { Injectable, signal } from '@angular/core';
import type { CvGenerationPhase, GeneratedCvDraft } from '../models/cv.models';

@Injectable({
  providedIn: 'root',
})
export class CvDraftService {
  readonly draft = signal<GeneratedCvDraft | null>(null);
  readonly phase = signal<CvGenerationPhase>('idle');
  readonly phaseMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  setDraft(draft: GeneratedCvDraft): void {
    this.draft.set(draft);
    this.phase.set('done');
    this.phaseMessage.set(null);
    this.errorMessage.set(null);
  }

  updateDraft(updater: (current: GeneratedCvDraft) => GeneratedCvDraft): void {
    const current = this.draft();
    if (!current) return;
    this.draft.set(updater(current));
  }

  setPhase(phase: CvGenerationPhase, message?: string): void {
    this.phase.set(phase);
    this.phaseMessage.set(message ?? null);
  }

  setError(message: string): void {
    this.errorMessage.set(message);
    this.phase.set('error');
    this.phaseMessage.set(null);
  }

  clear(): void {
    this.draft.set(null);
    this.phase.set('idle');
    this.phaseMessage.set(null);
    this.errorMessage.set(null);
  }

  hasDraft(): boolean {
    return this.draft() !== null;
  }
}
