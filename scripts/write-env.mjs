// Genera src/environments/environment.ts en builds de CI (Vercel) a partir de variables de entorno.
// Si el archivo ya existe (desarrollo local o deploy por CLI), no lo toca.
import { existsSync, writeFileSync } from 'node:fs';

const target = new URL('../src/environments/environment.ts', import.meta.url);

if (existsSync(target)) {
  console.log('[write-env] environment.ts ya existe, se mantiene.');
  process.exit(0);
}

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[write-env] Faltan SUPABASE_URL y/o SUPABASE_ANON_KEY en las variables de entorno.');
  process.exit(1);
}

const env = {
  production: true,
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_ANON_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite',
  geminiTimeout: Number(process.env.GEMINI_TIMEOUT ?? 600_000),
  geminiMaxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 16_384),
  geminiTemperature: Number(process.env.GEMINI_TEMPERATURE ?? 0.2),
};

writeFileSync(target, `export const environment = ${JSON.stringify(env, null, 2)};\n`);
console.log('[write-env] environment.ts generado desde variables de entorno.');
