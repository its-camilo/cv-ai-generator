import * as esbuild from 'esbuild';
import { existsSync, writeFileSync } from 'node:fs';

const outFile = new URL('../api/mcp.mjs', import.meta.url);

await esbuild.build({
  entryPoints: [new URL('../mcp-server/vercel-entry.ts', import.meta.url).pathname],
  outfile: outFile.pathname,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  logLevel: 'info',
});

writeFileSync(
  new URL('../api/package.json', import.meta.url),
  JSON.stringify({ type: 'module' }, null, 2) + '\n',
);

if (existsSync(new URL('../api/mcp.ts', import.meta.url))) {
  console.log('[bundle-mcp] api/mcp.ts is ignored when api/mcp.mjs exists');
}

console.log('[bundle-mcp] Wrote api/mcp.mjs');