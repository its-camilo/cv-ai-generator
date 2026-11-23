# CV AI Generator

Generador de CVs con IA que personaliza tu currículum para cada oferta de trabajo. Guardás un perfil maestro, pegás la descripción del puesto y obtenés un CV en español o inglés con vista previa y descarga en PDF.

Construido con **Angular 21**, autenticación en **Supabase** y **Gemini** (con fallback a OpenRouter) mediante Edge Function para generar y ajustar cada sección. Incluye edición manual, regeneración selectiva con instrucciones y layout optimizado para móvil y carta US Letter.

**Producción:** [cv-ai-generator-rho.vercel.app](https://cv-ai-generator-rho.vercel.app)

## Stack

- Angular 21 (standalone, signals, reactive forms)
- Supabase Auth
- Gemini API con fallback a OpenRouter (Supabase Edge Function)
- html2canvas + jsPDF (exportación PDF)
- Playwright (e2e)

## Desarrollo

```bash
npm install
npm start
```

Abre [http://localhost:4200](http://localhost:4200).

Variables de entorno en `src/environments/environment.ts` (no versionado). Las claves de Gemini y OpenRouter se configuran únicamente como secrets de la Edge Function de Supabase; nunca se exponen en el frontend. Gemini se intenta primero y, si falla, se usa el modelo gratuito `openrouter/free` de OpenRouter (el endpoint de API es `https://openrouter.ai/api/v1/chat/completions`). Para configurarlas, agrega las claves en `.env` local (copia `.env.example`) y ejecuta `npm run secrets:ai`; basta con tener configurada al menos una clave. Luego publica la Edge Function actualizada con `npm run deploy:ai` (requiere sesión de Supabase CLI).

## MCP remoto (agentes de IA)

Cualquier usuario autenticado puede crear **su propia** clave MCP en la app:

1. Inicia sesión en el [dashboard](https://cv-ai-generator-rho.vercel.app/dashboard).
2. Abre **Clave MCP** (`/dashboard/settings`) desde la tarjeta del inicio del dashboard.
3. Pulsa **Generar clave MCP** (etiqueta opcional). La clave completa se muestra **una sola vez**; guárdala en tu gestor de secretos.

**Endpoint (Streamable HTTP):** `https://cv-ai-generator-rho.vercel.app/api/mcp`  
**Autenticación:** cabecera `Authorization: Bearer <tu_clave_personal>` (prefijo típico `cvai_…`).

Ejemplo en Cursor / cliente MCP:

```json
{
  "mcpServers": {
    "cv-ai-generator": {
      "url": "https://cv-ai-generator-rho.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer TU_CLAVE_AQUI"
      }
    }
  }
}
```

### Herramientas

| Tool | Entrada principal | Salida |
|------|-------------------|--------|
| `generate_cv` | `ofertaTexto` (texto **completo** de la oferta), opcional `language` (`es` \| `en`), `empresaSlugOverride` | JSON con `downloadUrl`, `fileName`, `sobreMi`, `habilidadesLineas`, etc. |
| `list_recent_cvs` | opcional `limit` (1–25) | Lista de CVs recientes con enlaces firmados |
| `get_base_profile` | — | Perfil maestro, experiencia y educación |

Las generaciones se serializan **una por usuario**; si la IA está saturada, el servidor reintenta con backoff.

### Variables de entorno del servidor (Vercel)

| Variable | Uso |
|----------|-----|
| `SUPABASE_URL` | Proyecto Supabase |
| `SUPABASE_ANON_KEY` | Invocar Edge Function `gemini-generate` |
| `SUPABASE_SERVICE_ROLE_KEY` | Resolver claves MCP, leer perfil y subir PDFs como el usuario |

Pruebas locales: `npm run test:mcp` y `npm run test:mcp:endpoint` (sin clave debe responder **401**).

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm start` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm test` | Tests unitarios (Vitest) |
| `npm run test:mcp` | Tests de auth MCP |
| `npm run test:mcp:endpoint` | Smoke test HTTP del endpoint |
| `npm run test:e2e:layout` | E2E de layout del CV (Playwright) |
