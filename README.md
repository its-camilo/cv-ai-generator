# CV AI Generator

Generador de CVs con IA que personaliza tu currículum para cada oferta de trabajo. Guardás un perfil maestro, pegás la descripción del puesto y obtenés un CV en español o inglés con vista previa y descarga en PDF.

Construido con **Angular 21**, autenticación en **Supabase** y **Gemini** (Edge Function) para generar y ajustar cada sección. Incluye edición manual, regeneración selectiva con instrucciones y layout optimizado para móvil y carta US Letter.

**Producción:** [cv-ai-generator-rho.vercel.app](https://cv-ai-generator-rho.vercel.app)

## Stack

- Angular 21 (standalone, signals, reactive forms)
- Supabase Auth
- Gemini API (Supabase Edge Function)
- html2canvas + jsPDF (exportación PDF)
- Playwright (e2e)

## Desarrollo

```bash
npm install
npm start
```

Abre [http://localhost:4200](http://localhost:4200).

Variables de entorno en `src/environments/environment.ts` (no versionado). La clave de Gemini va en la Edge Function de Supabase, no en el frontend.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm start` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm test` | Tests unitarios (Vitest) |
| `npm run test:e2e:layout` | E2E de layout del CV (Playwright) |
