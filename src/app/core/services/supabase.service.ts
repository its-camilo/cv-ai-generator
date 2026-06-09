import { Injectable } from '@angular/core';
import { AuthChangeEvent, createClient, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { BehaviorSubject, filter, firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private currentUser = new BehaviorSubject<User | null>(null);
  private authInitialized = new BehaviorSubject<boolean>(false);

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    void this.bootstrapAuth();

    this.supabase.auth.onAuthStateChange((event, session) => {
      this.handleAuthStateChange(event, session);
    });
  }

  private async bootstrapAuth(): Promise<void> {
    const {
      data: { session },
    } = await this.supabase.auth.getSession();
    this.currentUser.next(session?.user ?? null);
    this.authInitialized.next(true);
  }

  private handleAuthStateChange(event: AuthChangeEvent, session: Session | null): void {
    if (event === 'SIGNED_OUT') {
      this.currentUser.next(null);
      return;
    }

    if (session?.user) {
      this.currentUser.next(session.user);
      return;
    }

    if (event === 'INITIAL_SESSION') {
      this.currentUser.next(session?.user ?? null);
      this.authInitialized.next(true);
    }
  }

  async waitForAuth(): Promise<User | null> {
    if (this.authInitialized.value) {
      return this.currentUser.value;
    }

    await firstValueFrom(this.authInitialized$.pipe(filter(Boolean)));
    return this.currentUser.value;
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/dashboard',
      },
    });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  get user$(): Observable<User | null> {
    return this.currentUser.asObservable();
  }

  get authInitialized$(): Observable<boolean> {
    return this.authInitialized.asObservable().pipe(filter(Boolean));
  }

  /** @deprecated Use authInitialized$ */
  get authReady$(): Observable<boolean> {
    return this.authInitialized$;
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}
