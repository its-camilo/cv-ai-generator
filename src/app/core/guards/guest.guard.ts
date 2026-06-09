import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { sanitizeReturnUrl } from '../utils/return-url';

export const guestGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  const user = await supabase.waitForAuth();

  if (!user) {
    return true;
  }

  const returnUrl = sanitizeReturnUrl(route.queryParamMap.get('returnUrl') ?? undefined);
  return router.createUrlTree([returnUrl]);
};
