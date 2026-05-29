import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { AsyncPipe } from '@angular/common';
import { Observable } from 'rxjs';
import type { CvLanguage } from '../../../core/models/cv.models';
import { CvDraftService } from '../../../core/services/cv-draft.service';
import { CvGenerationService } from '../../../core/services/cv-generation.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-generate-cv-page',
  imports: [RouterLink, AsyncPipe],
  templateUrl: './generate-cv-page.html',
  styleUrl: './generate-cv-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerateCvPage {
  private readonly router = inject(Router);
  private readonly supabase = inject(SupabaseService);
  private readonly cvGeneration = inject(CvGenerationService);
  private readonly draftService = inject(CvDraftService);

  readonly user$: Observable<User | null> = this.supabase.user$;
  readonly ofertaTexto = signal('');
  readonly language = signal<CvLanguage>('es');
  readonly generating = signal(false);

  readonly phase = this.draftService.phase;
  readonly phaseMessage = this.draftService.phaseMessage;
  readonly errorMessage = this.draftService.errorMessage;

  updateOferta(value: string): void {
    this.ofertaTexto.set(value);
  }

  setLanguage(lang: CvLanguage): void {
    this.language.set(lang);
  }

  async handleGenerate(user: User): Promise<void> {
    if (!this.ofertaTexto().trim() || this.generating()) return;

    this.generating.set(true);
    this.draftService.clear();

    try {
      await this.cvGeneration.generateFromOferta(
        user,
        this.ofertaTexto(),
        this.language(),
      );
      await this.router.navigate(['/dashboard/generar-cv/vista-previa']);
    } catch {
      // error already in draftService
    } finally {
      this.generating.set(false);
    }
  }
}
