import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { Grainient } from '../../shared/ui/grainient/grainient';
import { GlareHover } from '../../shared/ui/glare-hover/glare-hover';

@Component({
  selector: 'app-login',
  imports: [Grainient, GlareHover],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly supabase = inject(SupabaseService);

  readonly isSigningIn = signal(false);

  readonly titleWords = [
    { text: 'CV', delay: 120 },
    { text: 'AI', delay: 280 },
    { text: 'Generator', delay: 440 },
  ];

  readonly steps = [
    {
      number: '01',
      title: 'Centraliza tu perfil',
      text: 'Guarda experiencia, habilidades y logros en un solo lugar.',
      delay: 600,
    },
    {
      number: '02',
      title: 'Adapta con IA',
      text: 'Genera un CV distinto para cada vacante en segundos.',
      delay: 780,
    },
    {
      number: '03',
      title: 'Postula con confianza',
      text: 'Descarga, revisa y envía sin empezar desde cero.',
      delay: 960,
    },
  ];

  async handleLogin(): Promise<void> {
    if (this.isSigningIn()) return;

    this.isSigningIn.set(true);
    try {
      await this.supabase.signInWithGoogle();
    } catch (error) {
      console.error('Error al iniciar sesión', error);
      this.isSigningIn.set(false);
    }
  }
}
