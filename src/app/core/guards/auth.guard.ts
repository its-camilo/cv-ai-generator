import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { sanitizeReturnUrl } from '../utils/return-url';

export const authGuard: CanActivateFn = async (_route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  const user = await supabase.waitForAuth();

  if (user) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: sanitizeReturnUrl(state.url) },
  });
};
