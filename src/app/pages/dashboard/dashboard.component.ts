import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { combineLatest, Observable } from 'rxjs';
import { SupabaseService } from '../../core/services/supabase.service';
import { Grainient } from '../../shared/ui/grainient/grainient';

@Component({
  selector: 'app-dashboard',
  imports: [AsyncPipe, Grainient],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  readonly user$: Observable<User | null> = this.supabase.user$;

  ngOnInit(): void {
    combineLatest([this.supabase.authReady$, this.user$]).subscribe(([, user]) => {
      if (!user) {
        this.router.navigate(['/login']);
      }
    });
  }

  async handleLogout(): Promise<void> {
    await this.supabase.signOut();
  }
}
