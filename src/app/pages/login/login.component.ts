import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthError } from '@supabase/supabase-js';
import { sanitizeReturnUrl } from '../../core/utils/return-url';
import { SupabaseService } from '../../core/services/supabase.service';
import { Grainient } from '../../shared/ui/grainient/grainient';
import { GlareHover } from '../../shared/ui/glare-hover/glare-hover';

@Component({
  selector: 'app-login',
  imports: [Grainient, GlareHover, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly isSigningIn = signal(false);
  readonly isSubmittingEmail = signal(false);
  readonly emailError = signal<string | null>(null);
  readonly emailNotice = signal<string | null>(null);
  readonly suggestPasswordSetup = signal(false);

  readonly emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

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

  async handleEmailLogin(): Promise<void> {
    if (this.isSubmittingEmail()) return;
    this.emailForm.markAllAsTouched();
    if (this.emailForm.invalid) return;

    const { email, password } = this.emailForm.getRawValue();
    this.resetEmailMessages();
    this.isSubmittingEmail.set(true);
    try {
      await this.supabase.signInWithPassword(email.trim(), password);
      const returnUrl = sanitizeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
      await this.router.navigateByUrl(returnUrl);
    } catch (error) {
      if (error instanceof AuthError && error.code === 'email_not_confirmed') {
        this.emailError.set('Confirma tu correo antes de iniciar sesión.');
      } else {
        // Puede ser una cuenta creada con Google que aún no tiene contraseña.
        this.emailError.set('Correo o contraseña incorrectos.');
        this.suggestPasswordSetup.set(true);
      }
    } finally {
      this.isSubmittingEmail.set(false);
    }
  }

  async handlePasswordSetup(): Promise<void> {
    const emailControl = this.emailForm.controls.email;
    emailControl.markAsTouched();
    if (emailControl.invalid) {
      this.emailError.set('Escribe tu correo para enviarte el enlace.');
      return;
    }

    this.resetEmailMessages();
    this.isSubmittingEmail.set(true);
    try {
      await this.supabase.sendPasswordSetupEmail(emailControl.value.trim());
      this.emailNotice.set(
        'Si el correo tiene una cuenta (también con Google), te enviamos un enlace para crear o restablecer tu contraseña.',
      );
    } catch (error) {
      console.error('Error al enviar el enlace', error);
      this.emailError.set('No pudimos enviar el enlace. Intenta de nuevo en unos minutos.');
    } finally {
      this.isSubmittingEmail.set(false);
    }
  }

  private resetEmailMessages(): void {
    this.emailError.set(null);
    this.emailNotice.set(null);
    this.suggestPasswordSetup.set(false);
  }
}
