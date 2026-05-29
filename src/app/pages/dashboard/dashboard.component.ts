import { Component, inject, OnInit } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { combineLatest, Observable } from 'rxjs';
import { User } from '@supabase/supabase-js';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="user$ | async as user; else loading">
      <nav>
        <h2>Panel de Control - CV Master</h2>
        <p>Usuario: {{ user.email }}</p>
        <button (click)="handleLogout()">Cerrar Sesión</button>
      </nav>
      <main>
        <h3>Tu Inventario Profesional</h3>
        </main>
    </div>
    <ng-template #loading>
      <p>Cargando sesión o redirigiendo...</p>
    </ng-template>
  `,
  styles: [`
    nav { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #f5f5f5; border-bottom: 1px solid #ddd;}
    main { padding: 2rem; }
  `]
})
export class DashboardComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  user$: Observable<User | null> = this.supabase.user$;

  ngOnInit() {
    combineLatest([this.supabase.authReady$, this.user$]).subscribe(([, user]) => {
      if (!user) {
        this.router.navigate(['/login']);
      }
    });
  }

  async handleLogout() {
    await this.supabase.signOut();
  }
}
