import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import {
  GeminiGenerateContentOptions,
  GeminiGenerateResult,
  generateContent,
  generateContentDetailed,
  verifyGeminiConnection,
} from '../api/gemini-api';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private readonly supabase = inject(SupabaseService).getClient();

  generateContent(userPrompt: string, options?: GeminiGenerateContentOptions): Promise<string> {
    return generateContent(this.supabase, userPrompt, options);
  }

  generateContentDetailed(
    userPrompt: string,
    options?: GeminiGenerateContentOptions,
  ): Promise<GeminiGenerateResult> {
    return generateContentDetailed(this.supabase, userPrompt, options);
  }

  verifyConnection() {
    return verifyGeminiConnection(this.supabase);
  }
}

/** Expuesto para pruebas puntuales sin inyectar el servicio. */
export const geminiApi = {
  generateContent,
  generateContentDetailed,
  verifyGeminiConnection,
};
