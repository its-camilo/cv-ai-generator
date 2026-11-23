import type { VercelRequest, VercelResponse } from '@vercel/node';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { authenticateMcpRequest } from '../mcp-server/lib/auth.js';
import { createMcpServerForUser } from '../mcp-server/lib/mcp-server-factory.js';

export const config = {
  maxDuration: 300,
};

function headerRecord(req: VercelRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  return headers;
}

function toWebRequest(req: VercelRequest): Request {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https';
  const host = req.headers.host ?? 'localhost';
  const path = req.url ?? '/api/mcp';
  const url = `${proto}://${host}${path}`;

  const method = req.method ?? 'POST';
  const hasBody = method !== 'GET' && method !== 'HEAD';

  return new Request(url, {
    method,
    headers: headerRecord(req),
    body:
      hasBody ?
        typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body ?? {})
      : undefined,
  });
}

async function sendWebResponse(webResponse: Response, res: VercelResponse): Promise<void> {
  res.status(webResponse.status);
  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return;
    res.setHeader(key, value);
  });
  const buffer = Buffer.from(await webResponse.arrayBuffer());
  res.send(buffer);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Session-Id');
    res.status(204).end();
    return;
  }

  const authHeader = req.headers.authorization;
  const auth =
    authHeader ??
    (typeof req.headers['Authorization'] === 'string' ? req.headers['Authorization'] : undefined);

  let user;
  try {
    user = await authenticateMcpRequest(auth);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auth configuration error';
    res.status(500).json({ error: message });
    return;
  }

  if (!user) {
    res.status(401).json({ error: 'Unauthorized: Bearer MCP API key required' });
    return;
  }

  try {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const server = createMcpServerForUser(user.userId);
    await server.connect(transport);

    const webRequest = toWebRequest(req);
    const webResponse = await transport.handleRequest(webRequest);
    await sendWebResponse(webResponse, res);
  } catch (error) {
    console.error('[mcp]', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal MCP error',
    });
  }
}