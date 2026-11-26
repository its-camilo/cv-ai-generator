import { defineConfig } from 'nitro';
// Carga la ampliación de tipos que añade la opción `workflow` a la config de Nitro.
import type {} from 'workflow/nitro';

// Nitro empaqueta el servidor MCP y el Workflow SDK (workflow/nitro) para Vercel.
// `ng build` corre antes: Nitro publica dist/cv-ai-generator/browser como estáticos y
// usa su index.html como fallback SPA para rutas del dashboard (p. ej. /dashboard/settings).
export default defineConfig({
  preset: 'vercel',
  serverDir: './mcp-server/server',
  modules: ['workflow/nitro'],
  workflow: {
    dirs: ['mcp-server/workflows'],
  },
  publicAssets: [{ dir: 'dist/cv-ai-generator/browser', baseURL: '/' }],
  renderer: {
    template: 'dist/cv-ai-generator/browser/index.html',
    static: true,
  },
  // Chromium (@sparticuz/chromium) carga sus binarios comprimidos desde su carpeta bin/,
  // que el trazado de dependencias no detecta: se copia el paquete completo.
  traceDeps: ['@sparticuz/chromium*'],
  vercel: {
    functions: {
      memory: 1024,
    },
  },
});
