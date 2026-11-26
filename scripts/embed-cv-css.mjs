// Incrusta cv-document.css (la misma hoja del dashboard) como módulo TS para el servidor MCP.
// El PDF se renderiza dentro de una Vercel Function (Nitro), donde src/ no existe en disco,
// así que la hoja debe ir dentro del bundle en lugar de leerse con readFileSync en runtime.
import { readFileSync, writeFileSync } from 'node:fs';

const source = new URL(
  '../src/app/pages/dashboard/cv-preview/cv-document/cv-document.css',
  import.meta.url,
);
const target = new URL('../mcp-server/lib/cv-document-css.generated.ts', import.meta.url);

const css = readFileSync(source, 'utf8');
const content =
  '// Archivo generado por scripts/embed-cv-css.mjs. No editar a mano.\n' +
  `export const CV_DOCUMENT_CSS = ${JSON.stringify(css)};\n`;

let previous = '';
try {
  previous = readFileSync(target, 'utf8');
} catch {
  // primera generación
}

if (previous !== content) {
  writeFileSync(target, content);
  console.log('[embed-cv-css] Wrote mcp-server/lib/cv-document-css.generated.ts');
} else {
  console.log('[embed-cv-css] cv-document-css.generated.ts up to date');
}
