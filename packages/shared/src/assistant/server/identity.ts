import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

const digest = (value: string) => createHash('sha256').update(value).digest();

function bearerMatches(header: string | null, token: string): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  // Hashing first gives equal-length buffers, so the compare leaks nothing about the length.
  return timingSafeEqual(digest(header.slice('Bearer '.length)), digest(token));
}

/**
 * The address a request should be limited by. Only a caller holding the relay token may name
 * the visitor through `x-assistant-client-ip`; everyone else is identified by their own address.
 */
export function resolveVisitorIp(headers: Pick<Headers, 'get'>, relayToken: string | undefined): string {
  if (relayToken && bearerMatches(headers.get('authorization'), relayToken)) {
    const relayed = headers.get('x-assistant-client-ip')?.trim();
    if (relayed && isIP(relayed)) return relayed;
  }
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
