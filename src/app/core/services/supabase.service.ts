import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { BehaviorSubject, filter, Observable, take } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private currentUser = new BehaviorSubject<User | null>(null);
  private authReady = new BehaviorSubject<boolean>(false);

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.currentUser.next(session?.user ?? null);
      this.authReady.next(true);
    });
  }

  // Método de Login con Google
  async signInWithGoogle() {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/dashboard'
      }
    });
    if (error) throw error;
  }

  // Método de Logout
  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  // Observable para reaccionar al estado del usuario en la UI
  get user$(): Observable<User | null> {
    return this.currentUser.asObservable();
  }

  // Emite cuando Supabase terminó de evaluar la sesión (incl. tras OAuth redirect)
  get authReady$(): Observable<boolean> {
    return this.authReady.asObservable().pipe(filter(Boolean), take(1));
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}
