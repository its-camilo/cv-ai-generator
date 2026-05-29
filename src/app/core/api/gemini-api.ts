import type { SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export interface GeminiGenerateContentOptions {
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface GeminiGenerateResult {
  text: string;
  model: string;
  usageMetadata: Record<string, unknown> | null;
}

export class GeminiApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GeminiApiError';
    this.status = status;
  }
}

interface EdgeFunctionSuccess {
  text: string;
  model: string;
  usageMetadata: Record<string, unknown> | null;
}

interface EdgeFunctionError {
  error: string;
}

const GEMINI_FUNCTION = 'gemini-generate';

/**
 * Genera contenido vía Edge Function de Supabase (la API key vive solo en el servidor).
 */
export async function generateContent(
  supabase: SupabaseClient,
  userPrompt: string,
  options?: GeminiGenerateContentOptions,
): Promise<string> {
  const result = await generateContentDetailed(supabase, userPrompt, options);
  return result.text;
}

export async function generateContentDetailed(
  supabase: SupabaseClient,
  userPrompt: string,
  options?: GeminiGenerateContentOptions,
): Promise<GeminiGenerateResult> {
  const trimmed = userPrompt.trim();
  if (!trimmed) {
    throw new GeminiApiError('userPrompt vacío', 400);
  }

  const invokePromise = supabase.functions.invoke<EdgeFunctionSuccess>(GEMINI_FUNCTION, {
    body: {
      userPrompt: trimmed,
      systemPrompt: options?.systemPrompt?.trim() || undefined,
      temperature: options?.temperature ?? environment.geminiTemperature,
      maxOutputTokens: options?.maxOutputTokens ?? environment.geminiMaxOutputTokens,
    },
  });

  let data: EdgeFunctionSuccess | null;
  let error: { message?: string; context?: Response } | null;

  if (options?.signal) {
    if (options.signal.aborted) {
      throw new GeminiApiError('Solicitud cancelada', 499);
    }
    const raced = await Promise.race([
      invokePromise,
      new Promise<never>((_, reject) => {
        options.signal!.addEventListener(
          'abort',
          () => reject(new GeminiApiError('Solicitud cancelada', 499)),
          { once: true },
        );
      }),
    ]);
    data = raced.data;
    error = raced.error;
  } else {
    const response = await invokePromise;
    data = response.data;
    error = response.error;
  }

  if (error) {
    let message = error.message ?? 'Error al invocar gemini-generate';
    const response = error.context;

    if (response) {
      try {
        const payload = (await response.json()) as EdgeFunctionError;
        if (payload.error) message = payload.error;
      } catch {
        // usar message por defecto
      }
    }

    throw new GeminiApiError(message, response?.status ?? 500);
  }

  if (!data?.text) {
    throw new GeminiApiError('La respuesta no contiene texto', 502);
  }

  return {
    text: data.text,
    model: data.model,
    usageMetadata: data.usageMetadata,
  };
}

/** Prueba mínima de conectividad (requiere sesión activa). */
export async function verifyGeminiConnection(
  supabase: SupabaseClient,
): Promise<{ ok: boolean; model: string; text: string }> {
  const result = await generateContentDetailed(supabase, 'Responde solo: OK');
  return {
    ok: result.text.trim().toUpperCase() === 'OK',
    model: result.model,
    text: result.text,
  };
}
