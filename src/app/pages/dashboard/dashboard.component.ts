import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { filter, Observable, pairwise } from 'rxjs';
import { SupabaseService } from '../../core/services/supabase.service';
import { sanitizeReturnUrl } from '../../core/utils/return-url';
import { Grainient } from '../../shared/ui/grainient/grainient';

@Component({
  selector: 'app-dashboard',
  imports: [AsyncPipe, Grainient, RouterOutlet],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly user$: Observable<User | null> = this.supabase.user$;
  readonly authInitialized$ = this.supabase.authInitialized$;

  ngOnInit(): void {
    this.supabase.user$
      .pipe(
        pairwise(),
        filter(([previousUser, currentUser]) => previousUser !== null && currentUser === null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        void this.router.navigate(['/login'], {
          queryParams: { returnUrl: sanitizeReturnUrl(this.router.url) },
        });
      });
  }

  async handleLogout(): Promise<void> {
    await this.supabase.signOut();
  }
}
