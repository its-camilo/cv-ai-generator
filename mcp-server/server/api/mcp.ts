import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { defineEventHandler } from 'nitro/h3';
import { authenticateMcpRequest } from '../../lib/auth.js';
import { createMcpServerForUser } from '../../lib/mcp-server-factory.js';
import { getSupabaseAdmin } from '../../lib/supabase-admin.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id',
};

/** Endpoint MCP (Streamable HTTP, sin sesión): POST /api/mcp con Bearer <clave MCP>. */
export default defineEventHandler(async ({ req }) => {
  try {
    getSupabaseAdmin();
  } catch {
    return Response.json(
      { error: 'MCP server is not fully configured (missing SUPABASE_SERVICE_ROLE_KEY on Vercel).' },
      { status: 503 },
    );
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  let user;
  try {
    user = await authenticateMcpRequest(req.headers.get('authorization') ?? undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auth configuration error';
    return Response.json({ error: message }, { status: 500 });
  }

  if (!user) {
    return Response.json({ error: 'Unauthorized: Bearer MCP API key required' }, { status: 401 });
  }

  try {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const server = createMcpServerForUser(user.userId);
    await server.connect(transport);
    return await transport.handleRequest(req);
  } catch (error) {
    console.error('[mcp]', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal MCP error' },
      { status: 500 },
    );
  }
});
