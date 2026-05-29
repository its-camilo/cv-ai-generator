#!/usr/bin/env node
/**
 * Verificación local de GEMINI_API_KEY (lee .env en la raíz del proyecto).
 * Uso: npm run verify:gemini
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');

function loadEnv() {
  try {
    const raw = readFileSync(envPath, 'utf8');
    const env = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
    return env;
  } catch {
    console.error('No se encontró .env. Copia .env.example y configura GEMINI_API_KEY.');
    process.exit(1);
  }
}

const env = loadEnv();
const apiKey = env.GEMINI_API_KEY;
const model = env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite';

if (!apiKey || apiKey === 'TU_GEMINI_API_KEY') {
  console.error('GEMINI_API_KEY no configurada en .env');
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: 'Responde solo: OK' }] }],
    generationConfig: { maxOutputTokens: 16, temperature: 0.2 },
  }),
});

const data = await response.json();
const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

if (!response.ok) {
  console.error('Error Gemini:', data.error?.message ?? response.status);
  process.exit(1);
}

console.log(`OK — modelo: ${data.modelVersion ?? model}, respuesta: "${text.trim()}"`);
