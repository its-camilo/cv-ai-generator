#!/usr/bin/env bash
# Configura secrets de IA en Supabase Edge Functions.
# Requiere: supabase login (una vez) o SUPABASE_ACCESS_TOKEN en el entorno.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
PROJECT_REF="pijeknfihtnyaqwwxqrm"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Falta .env — copia .env.example y configura al menos GEMINI_API_KEY u OPENROUTER_API_KEY."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

SECRETS=(
  "GEMINI_MODEL=${GEMINI_MODEL:-gemini-3.1-flash-lite}"
  "GEMINI_TEMPERATURE=${GEMINI_TEMPERATURE:-0.2}"
  "GEMINI_MAX_OUTPUT_TOKENS=${GEMINI_MAX_OUTPUT_TOKENS:-16384}"
  "OPENROUTER_MODEL=${OPENROUTER_MODEL:-openrouter/free}"
)
HAS_PROVIDER_KEY=false

if [[ -n "${GEMINI_API_KEY:-}" && "$GEMINI_API_KEY" != "TU_GEMINI_API_KEY" ]]; then
  SECRETS+=("GEMINI_API_KEY=$GEMINI_API_KEY")
  HAS_PROVIDER_KEY=true
fi

if [[ -n "${OPENROUTER_API_KEY:-}" && "$OPENROUTER_API_KEY" != "TU_OPENROUTER_API_KEY" ]]; then
  SECRETS+=("OPENROUTER_API_KEY=$OPENROUTER_API_KEY")
  HAS_PROVIDER_KEY=true
fi

if [[ "$HAS_PROVIDER_KEY" != true ]]; then
  echo "Configura GEMINI_API_KEY u OPENROUTER_API_KEY en .env"
  exit 1
fi

# Pasar los valores por un archivo temporal (permisos 600) y no como argumentos,
# para que las claves no queden visibles en la lista de procesos ni en logs.
umask 077
TMP_ENV="$(mktemp)"
trap 'rm -f "$TMP_ENV"' EXIT
printf '%s\n' "${SECRETS[@]}" > "$TMP_ENV"

npx supabase secrets set --env-file "$TMP_ENV" --project-ref "$PROJECT_REF" > /dev/null

echo "Secrets configurados en proyecto $PROJECT_REF:"
for entry in "${SECRETS[@]}"; do echo "  - ${entry%%=*}"; done
