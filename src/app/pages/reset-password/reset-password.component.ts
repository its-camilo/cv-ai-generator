import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { Grainient } from '../../shared/ui/grainient/grainient';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirm')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

/**
 * Crea o cambia la contraseña de la cuenta con sesión activa. Se llega aquí desde el
 * enlace de recuperación o estando logueado con Google; en ambos casos la contraseña
 * se agrega al mismo usuario, así que luego funcionan Google y correo/contraseña.
 */
@Component({
  selector: 'app-reset-password',
  imports: [Grainient, ReactiveFormsModule],
  templateUrl: './reset-password.html',
  styleUrl: '../login/login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly isSaving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  async handleSubmit(): Promise<void> {
    if (this.isSaving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set(
        this.form.hasError('mismatch')
          ? 'Las contraseñas no coinciden.'
          : 'La contraseña debe tener al menos 8 caracteres.',
      );
      return;
    }

    this.error.set(null);
    this.isSaving.set(true);
    try {
      await this.supabase.updatePassword(this.form.getRawValue().password);
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      console.error('Error al guardar la contraseña', error);
      this.error.set('No pudimos guardar la contraseña. Intenta de nuevo.');
    } finally {
      this.isSaving.set(false);
    }
  }
}
