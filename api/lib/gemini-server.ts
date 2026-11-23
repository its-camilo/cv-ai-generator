import type { SupabaseClient } from '@supabase/supabase-js';
import { geminiDefaults } from './env.js';

export interface GenerateContentOptions {
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

const GEMINI_FUNCTION = 'gemini-generate';

function isRetryable(message: string, status?: number): boolean {
  if (status === 429 || status === 503 || status === 502) return true;
  const lower = message.toLowerCase();
  return (
    lower.includes('rate') ||
    lower.includes('quota') ||
    lower.includes('overloaded') ||
    lower.includes('resource exhausted') ||
    lower.includes('timed out') ||
    lower.includes('timeout')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateContentWithRetry(
  supabase: SupabaseClient,
  userPrompt: string,
  options?: GenerateContentOptions,
): Promise<string> {
  const trimmed = userPrompt.trim();
  if (!trimmed) throw new Error('userPrompt vacío');

  const defaults = geminiDefaults();
  const maxAttempts = 5;
  let lastError = 'Error desconocido de IA';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await supabase.functions.invoke<{ text?: string; error?: string }>(
      GEMINI_FUNCTION,
      {
        body: {
          userPrompt: trimmed,
          systemPrompt: options?.systemPrompt?.trim() || undefined,
          temperature: options?.temperature ?? defaults.temperature,
          maxOutputTokens: options?.maxOutputTokens ?? defaults.maxOutputTokens,
        },
      },
    );

    if (!error && data?.text) {
      return data.text;
    }

    let message = error?.message ?? data?.error ?? 'Error al invocar gemini-generate';
    const status = (error as { context?: Response } | null)?.context?.status;
    if ((error as { context?: Response })?.context) {
      try {
        const payload = (await (error as { context: Response }).context.json()) as { error?: string };
        if (payload.error) message = payload.error;
      } catch {
        // keep message
      }
    }

    lastError = message;
    if (attempt < maxAttempts - 1 && isRetryable(message, status)) {
      const backoffMs = Math.min(32_000, 2_000 * 2 ** attempt);
      await sleep(backoffMs);
      continue;
    }
    throw new Error(message);
  }

  throw new Error(lastError);
}