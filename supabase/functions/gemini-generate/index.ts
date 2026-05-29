import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return jsonResponse({ error: 'GEMINI_API_KEY not configured on server' }, 500);
    }

    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite';
    const defaultTemperature = Number(Deno.env.get('GEMINI_TEMPERATURE') ?? '0.2');
    const defaultMaxOutputTokens = Number(Deno.env.get('GEMINI_MAX_OUTPUT_TOKENS') ?? '16384');

    const body = (await req.json()) as GenerateRequest;
    const userPrompt = body.userPrompt?.trim();

    if (!userPrompt) {
      return jsonResponse({ error: 'userPrompt is required' }, 400);
    }

    const geminiBody: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: body.temperature ?? defaultTemperature,
        maxOutputTokens: body.maxOutputTokens ?? defaultMaxOutputTokens,
      },
    };

    if (body.systemPrompt?.trim()) {
      geminiBody.systemInstruction = { parts: [{ text: body.systemPrompt.trim() }] };
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      const message = geminiData.error?.message ?? `Gemini API error (${geminiRes.status})`;
      return jsonResponse({ error: message }, geminiRes.status);
    }

    const text =
      geminiData.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? '')
        .join('')
        .trim() ?? '';

    if (!text) {
      return jsonResponse({ error: 'Gemini response contained no text' }, 502);
    }

    return jsonResponse({
      text,
      model: geminiData.modelVersion ?? model,
      usageMetadata: geminiData.usageMetadata ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
