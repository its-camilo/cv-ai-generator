import { describe, expect, it } from 'vitest';
import { hashApiKey, parseBearerToken } from './auth.js';

describe('MCP auth helpers', () => {
  it('parses bearer tokens', () => {
    expect(parseBearerToken('Bearer cvai_test123')).toBe('cvai_test123');
    expect(parseBearerToken('Basic x')).toBeNull();
    expect(parseBearerToken(undefined)).toBeNull();
  });

  it('hashes keys deterministically', () => {
    const a = hashApiKey('cvai_same');
    const b = hashApiKey('cvai_same');
    const c = hashApiKey('cvai_other');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });

  it('trims bearer token before hashing (matches SQL resolve_mcp_api_key)', () => {
    expect(hashApiKey('  cvai_trimmed  ')).toBe(hashApiKey('cvai_trimmed'));
  });
});