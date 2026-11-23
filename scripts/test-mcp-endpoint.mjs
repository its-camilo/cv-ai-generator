#!/usr/bin/env node
/**
 * Prueba rápida del endpoint MCP (sin clave = 401).
 * Uso con clave: MCP_TEST_API_KEY=cvai_... node scripts/test-mcp-endpoint.mjs
 */
const base =
  process.env.MCP_TEST_BASE_URL?.trim() || 'https://cv-ai-generator-rho.vercel.app/api/mcp';

async function post(body, headers = {}) {
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text };
}

const initBody = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'mcp-test', version: '1.0.0' },
  },
};

const noAuth = await post(initBody);
console.log('Without token:', noAuth.status, noAuth.text.slice(0, 200));

const apiKey = process.env.MCP_TEST_API_KEY?.trim();
if (!apiKey) {
  console.log('Set MCP_TEST_API_KEY to run authenticated initialize/tools/list.');
  process.exit(noAuth.status === 401 ? 0 : 1);
}

const withAuth = await post(initBody, { Authorization: `Bearer ${apiKey}` });
console.log('With token (initialize):', withAuth.status, withAuth.text.slice(0, 400));

const toolsList = await post(
  { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  { Authorization: `Bearer ${apiKey}` },
);
console.log('tools/list:', toolsList.status, toolsList.text.slice(0, 600));