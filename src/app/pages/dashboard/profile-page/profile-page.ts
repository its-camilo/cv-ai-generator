import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { Observable } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ProfileForm } from '../profile-form/profile-form';

@Component({
  selector: 'app-profile-page',
  imports: [AsyncPipe, RouterLink, ProfileForm],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private readonly supabase = inject(SupabaseService);

  readonly user$: Observable<User | null> = this.supabase.user$;
}
