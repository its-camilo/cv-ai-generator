export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function geminiDefaults() {
  return {
    temperature: Number(process.env.GEMINI_TEMPERATURE ?? 0.2),
    maxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 16_384),
  };
}