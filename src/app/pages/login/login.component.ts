import { Component, inject, OnInit } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { Router } from '@angular/router';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <div class="login-container">
      <h1>Generador de CVs IA</h1>
      <p>Automatiza tu carrera con precisión.</p>
      <button (click)="handleLogin()">Iniciar sesión con Google</button>
    </div>
  `,
  styles: [`
    .login-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;}
    button { padding: 10px 20px; font-size: 16px; cursor: pointer; background-color: #4285F4; color: white; border: none; border-radius: 4px;}
  `]
})
export class LoginComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  ngOnInit() {
    combineLatest([this.supabase.authReady$, this.supabase.user$]).subscribe(([, user]) => {
      if (user) {
        this.router.navigate(['/dashboard']);
      }
    });
  }

  async handleLogin() {
    try {
      await this.supabase.signInWithGoogle();
    } catch (error) {
      console.error('Error al iniciar sesión', error);
    }
  }
}
