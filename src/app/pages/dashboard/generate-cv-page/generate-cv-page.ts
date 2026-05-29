import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-generate-cv-page',
  imports: [RouterLink],
  templateUrl: './generate-cv-page.html',
  styleUrl: './generate-cv-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerateCvPage {
  readonly ofertaTexto = signal('');

  updateOferta(value: string): void {
    this.ofertaTexto.set(value);
  }

  handleGenerate(): void {
    if (!this.ofertaTexto().trim()) return;
    // Placeholder: la integración con IA se conectará después.
  }
}
