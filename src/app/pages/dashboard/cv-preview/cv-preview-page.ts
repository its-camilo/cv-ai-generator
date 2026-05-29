import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  AfterViewInit,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CV_EDITOR_LABELS } from '../../../core/constants/cv-layout.constants';
import type { GeneratedCvDraft } from '../../../core/models/cv.models';
import { CvDraftService } from '../../../core/services/cv-draft.service';
import { CvGenerationService } from '../../../core/services/cv-generation.service';
import { PdfExportService } from '../../../core/services/pdf-export.service';
import {
  normalizeCvDraftSections,
  validateCvDraftSections,
} from '../../../core/utils/cv-validation';
import {
  computePageTune,
  measurePageOverflow,
  refinePageTuneFromElement,
} from '../../../core/utils/cv-page-tune';
import { createGlobantAiLeadE2eDraft } from '../../../core/testing/cv-e2e-fixture';
import { CvDocument } from './cv-document/cv-document';

const CV_PAGE_WIDTH_PX = 8.5 * 96;

@Component({
  selector: 'app-cv-preview-page',
  imports: [RouterLink, CvDocument],
  templateUrl: './cv-preview-page.html',
  styleUrl: './cv-preview-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CvPreviewPage implements OnInit, AfterViewInit {
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly draftService = inject(CvDraftService);
  private readonly cvGeneration = inject(CvGenerationService);
  private readonly pdfExport = inject(PdfExportService);

  readonly printRoot = viewChild<ElementRef<HTMLElement>>('printRoot');
  readonly paperWrap = viewChild<ElementRef<HTMLElement>>('paperWrap');

  readonly draft = this.draftService.draft;
  readonly paperScale = signal(1);
  readonly aiLoading = signal(false);
  readonly aiError = signal<string | null>(null);
  readonly downloadLoading = signal(false);
  readonly refineSobreInstruction = signal('');
  readonly refineSkillsInstruction = signal('');
  readonly editorLabels = CV_EDITOR_LABELS;

  ngOnInit(): void {
    this.loadLayoutE2eFixtureIfRequested();

    if (!this.draftService.hasDraft()) {
      void this.router.navigate(['/dashboard/generate-cv']);
      return;
    }
    this.normalizeDraftIfNeeded();
    this.applyInitialPageTune();
  }

  ngAfterViewInit(): void {
    this.setupPaperScale();
    void this.refinePageLayoutUntilStable();
  }

  private setupPaperScale(): void {
    const wrap = this.paperWrap()?.nativeElement;
    if (!wrap || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(([entry]) => {
      const target = entry.target as HTMLElement;
      const style = getComputedStyle(target);
      const paddingInline =
        (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0);
      const availableWidth = Math.max(0, entry.contentRect.width - paddingInline);
      const scale = availableWidth >= CV_PAGE_WIDTH_PX ? 1 : availableWidth / CV_PAGE_WIDTH_PX;
      this.paperScale.set(scale);
      this.cdr.markForCheck();
    });

    observer.observe(wrap);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  private loadLayoutE2eFixtureIfRequested(): void {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('e2e') !== 'layout') return;
    if (this.draftService.hasDraft()) return;

    const draft = createGlobantAiLeadE2eDraft();
    this.draftService.setDraft({ ...draft, pageTune: computePageTune(draft) });
  }

  private applyInitialPageTune(): void {
    const draft = this.draftService.draft();
    if (!draft) return;
    this.draftService.updateDraft((current) => ({
      ...current,
      pageTune: computePageTune(current),
    }));
  }

  private async refinePageLayoutUntilStable(): Promise<void> {
    for (let pass = 0; pass < 3; pass++) {
      const changed = this.refinePageLayout();
      if (!changed) break;
      this.cdr.detectChanges();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }

  private refinePageLayout(): boolean {
    const draft = this.draftService.draft();
    const root = this.printRoot()?.nativeElement;
    const el = root?.querySelector('.cv-doc') as HTMLElement | null;
    if (!draft || !el) return false;

    const baseTune = draft.pageTune ?? computePageTune(draft);
    const refined = refinePageTuneFromElement(draft, el, baseTune);
    const metrics = measurePageOverflow(el);

    if (metrics.overflows) {
      const safer = computePageTune(draft);
      this.draftService.updateDraft((current) => ({ ...current, pageTune: safer }));
      return true;
    }

    if (
      refined.gapScale === baseTune.gapScale &&
      refined.lineHeightScale === baseTune.lineHeightScale &&
      refined.fontScale === baseTune.fontScale
    ) {
      return false;
    }

    this.draftService.updateDraft((current) => ({ ...current, pageTune: refined }));
    return true;
  }

  private normalizeDraftIfNeeded(): void {
    const current = this.draftService.draft();
    if (!current) return;

    const normalized = normalizeCvDraftSections(current.sobreMi, current.habilidadesLineas);
    if (
      normalized.sobreMi === current.sobreMi &&
      normalized.habilidadesLineas.join('\n') === current.habilidadesLineas.join('\n')
    ) {
      return;
    }

    this.draftService.updateDraft((draft) => ({
      ...draft,
      sobreMi: normalized.sobreMi,
      habilidadesLineas: normalized.habilidadesLineas,
    }));
  }

  updateField<K extends keyof GeneratedCvDraft>(field: K, value: GeneratedCvDraft[K]): void {
    this.draftService.updateDraft((current) => ({ ...current, [field]: value }));
  }

  updateExperiencia(index: number, field: string, value: string): void {
    this.draftService.updateDraft((current) => ({
      ...current,
      experiencias: current.experiencias.map((exp, i) =>
        i === index ? { ...exp, [field]: value } : exp,
      ),
    }));
  }

  updateEducacion(index: number, field: string, value: string): void {
    this.draftService.updateDraft((current) => ({
      ...current,
      educaciones: current.educaciones.map((edu, i) =>
        i === index ? { ...edu, [field]: value } : edu,
      ),
    }));
  }

  updateHabilidadLine(index: number, value: string): void {
    this.draftService.updateDraft((current) => ({
      ...current,
      habilidadesLineas: current.habilidadesLineas.map((line, i) =>
        i === index ? value : line,
      ),
    }));
  }

  validationErrors(): string[] {
    const d = this.draft();
    if (!d) return [];
    return validateCvDraftSections(d.sobreMi, d.habilidadesLineas).errors;
  }

  validationWarnings(): string[] {
    return this.validationErrors();
  }

  async refineSobreMi(): Promise<void> {
    const instruction = this.refineSobreInstruction().trim();
    if (!instruction) return;
    await this.runAi(async () => {
      await this.cvGeneration.refineSobreMi(instruction);
      this.refineSobreInstruction.set('');
    });
  }

  async refineHabilidades(): Promise<void> {
    const instruction = this.refineSkillsInstruction().trim();
    if (!instruction) return;
    await this.runAi(async () => {
      await this.cvGeneration.refineHabilidades(instruction);
      this.refineSkillsInstruction.set('');
    });
  }

  async downloadPdf(): Promise<void> {
    const d = this.draft();
    const root = this.printRoot()?.nativeElement;
    if (!d || !root) return;

    const normalized = normalizeCvDraftSections(d.sobreMi, d.habilidadesLineas);
    let pageTune = d.pageTune ?? computePageTune({ ...d, ...normalized });
    this.draftService.updateDraft((draft) => ({
      ...draft,
      sobreMi: normalized.sobreMi,
      habilidadesLineas: normalized.habilidadesLineas,
      pageTune,
    }));
    this.cdr.detectChanges();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const el = root.querySelector('.cv-doc') as HTMLElement | null;
    if (!el) return;

    pageTune = refinePageTuneFromElement(
      { ...d, ...normalized, pageTune },
      el,
      pageTune,
    );
    this.draftService.updateDraft((draft) => ({ ...draft, pageTune }));
    this.cdr.detectChanges();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const exportEl = root.querySelector('.cv-doc') as HTMLElement | null;
    if (!exportEl) return;

    const previousTransform = root.style.transform;
    root.style.transform = 'none';

    this.downloadLoading.set(true);
    this.aiError.set(null);
    try {
      this.cdr.detectChanges();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await this.pdfExport.downloadElementAsPdf(exportEl, d.pdfFileName);
    } catch {
      this.aiError.set('No se pudo generar el PDF. Intenta de nuevo.');
    } finally {
      root.style.transform = previousTransform;
      this.downloadLoading.set(false);
    }
  }

  private async runAi(action: () => Promise<void>): Promise<void> {
    this.aiLoading.set(true);
    this.aiError.set(null);
    try {
      await action();
    } catch (error) {
      this.aiError.set(error instanceof Error ? error.message : 'Error con la IA');
    } finally {
      this.aiLoading.set(false);
    }
  }
}
