import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_TIMEOUT_MS = 55_000;
const OPENROUTER_TIMEOUT_MS = 85_000;
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

interface GenerateRequest {
  userPrompt?: string;
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = (await req.json()) as GenerateRequest;
    const userPrompt = body.userPrompt?.trim();

    if (!userPrompt) {
      return jsonResponse({ error: 'userPrompt is required' }, 400);
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!geminiApiKey && !openRouterApiKey) {
      return jsonResponse({ error: 'No AI provider API key configured on server' }, 500);
    }

    const defaultTemperature = Number(Deno.env.get('GEMINI_TEMPERATURE') ?? '0.2');
    const defaultMaxOutputTokens = Number(Deno.env.get('GEMINI_MAX_OUTPUT_TOKENS') ?? '16384');
    const temperature = body.temperature ?? defaultTemperature;
    const maxOutputTokens = body.maxOutputTokens ?? defaultMaxOutputTokens;
    let geminiError: string | null = null;

    if (geminiApiKey) {
      try {
        const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite';
        const geminiBody: Record<string, unknown> = {
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature, maxOutputTokens },
        };

        if (body.systemPrompt?.trim()) {
          geminiBody.systemInstruction = { parts: [{ text: body.systemPrompt.trim() }] };
        }

        // La clave va en cabecera (no en la URL) para que nunca aparezca en mensajes de error.
        const url =
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        const geminiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
          body: JSON.stringify(geminiBody),
          signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        });
        const geminiData = await readJson(geminiRes);

        if (!geminiRes.ok) {
          throw new Error(geminiData.error?.message ?? `Gemini API error (${geminiRes.status})`);
        }

        const text =
          geminiData.candidates?.[0]?.content?.parts
            ?.map((part: { text?: string }) => part.text ?? '')
            .join('')
            .trim() ?? '';

        if (!text) {
          throw new Error('Gemini response contained no text');
        }

        return jsonResponse({
          text,
          model: geminiData.modelVersion ?? model,
          usageMetadata: geminiData.usageMetadata ?? null,
        });
      } catch (error) {
        geminiError = safeErrorMessage(error, 'Unknown Gemini error', [geminiApiKey, openRouterApiKey]);
      }
    }

    if (!openRouterApiKey) {
      return jsonResponse({
        error: `${geminiError ?? 'Gemini is not configured'}; OPENROUTER_API_KEY not configured on server`,
      }, 502);
    }

    try {
      const model = Deno.env.get('OPENROUTER_MODEL') ?? 'openrouter/free';
      const messages = [
        ...(body.systemPrompt?.trim() ? [{ role: 'system', content: body.systemPrompt.trim() }] : []),
        { role: 'user', content: userPrompt },
      ];
      const openRouterRes = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxOutputTokens,
        }),
        signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
      });
      const openRouterData = await readJson(openRouterRes);

      if (!openRouterRes.ok) {
        throw new Error(openRouterData.error?.message ?? `OpenRouter API error (${openRouterRes.status})`);
      }

      const content = openRouterData.choices?.[0]?.message?.content;
      const text = (typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map((part: { text?: string }) => part.text ?? '').join('')
          : '').trim();

      if (!text) {
        throw new Error('OpenRouter response contained no text');
      }

      return jsonResponse({
        text,
        model: openRouterData.model ?? model,
        usageMetadata: openRouterData.usage ?? null,
      });
    } catch (error) {
      const openRouterError = safeErrorMessage(error, 'Unknown OpenRouter error', [geminiApiKey, openRouterApiKey]);
      return jsonResponse({
        error: geminiError
          ? `Gemini failed: ${geminiError}; OpenRouter fallback failed: ${openRouterError}`
          : `OpenRouter failed: ${openRouterError}`,
      }, 502);
    }
  } catch (error) {
    const message = safeErrorMessage(error, 'Unknown error', [
      Deno.env.get('GEMINI_API_KEY'),
      Deno.env.get('OPENROUTER_API_KEY'),
    ]);
    return jsonResponse({ error: message }, 500);
  }
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Lee JSON sin romper si el proveedor devuelve HTML o texto (p. ej. un 503 de un proxy). */
async function readJson(res: Response): Promise<any> {
  const raw = await res.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return { error: { message: `Non-JSON response (${res.status})` } };
  }
}

/** Mensaje de error apto para el cliente: sin claves y con los timeouts legibles. */
function safeErrorMessage(error: unknown, fallback: string, secrets: Array<string | undefined>): string {
  let message: string;
  if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    message = 'Request timed out';
  } else {
    message = error instanceof Error ? error.message : fallback;
  }
  for (const secret of secrets) {
    if (secret) message = message.split(secret).join('[redacted]');
  }
  return message;
}
