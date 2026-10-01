import { commandRegistry } from '../commands/registry';
import { tokenize } from '../shell/tokenizer';

export const MAX_LINK_LENGTH = 200;

export type AddressResult =
  | { kind: 'root' }
  | { kind: 'command'; line: string; form: 'path' | 'query' }
  | { kind: 'invalid'; reason: 'too-long' | 'undecodable' | 'ambiguous' | 'control-chars' }
  | { kind: 'not-command'; line: string };

export const routableCommandNames: ReadonlySet<string> = new Set(
  commandRegistry
    .filter((command) => !command.hidden && command.kind !== 'filter')
    .flatMap((command) => [command.name, ...command.aliases])
    .map((name) => name.toLowerCase()),
);

const pathSafeToken = /^[A-Za-z0-9._~][A-Za-z0-9._~-]*$/;
const textClient = /^(curl|Wget|HTTPie|xh|aria2|libfetch|Lynx|w3m)\//i;

function decodePath(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function decodeQuery(value: string): string | undefined {
  try {
    return decodeURIComponent(value.replaceAll('+', ' '));
  } catch {
    return undefined;
  }
}

function normalizeLine(line: string): { line: string } | { reason: 'too-long' | 'control-chars' } {
  const tabNormalized = line.replaceAll('\t', ' ');
  if (/[\u0000-\u0008\u000A-\u001F\u007F-\u009F]/.test(tabNormalized)) return { reason: 'control-chars' };
  const normalized = tabNormalized.trim();
  if (normalized.length > MAX_LINK_LENGTH) return { reason: 'too-long' };
  return { line: normalized };
}

function quoteSegment(segment: string): string {
  if (!/[\s|&;<>'"\\`$]/.test(segment)) return segment;
  return `"${segment.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function readCommandQuery(search: string): { value?: string; undecodable?: boolean } {
  const query = search.startsWith('?') ? search.slice(1) : search;
  for (const part of query.split('&')) {
    const separator = part.indexOf('=');
    const rawKey = separator === -1 ? part : part.slice(0, separator);
    const key = decodeQuery(rawKey);
    if (key !== 'cmd') continue;
    const rawValue = separator === -1 ? '' : part.slice(separator + 1);
    const value = decodeQuery(rawValue);
    return value === undefined ? { undecodable: true } : { value };
  }
  return {};
}

function pathLine(pathname: string): { line: string; name: string } | { reason: 'undecodable' | 'too-long' | 'control-chars' } | undefined {
  const rawSegments = pathname.split('/').filter(Boolean);
  if (!rawSegments.length) return undefined;

  const segments: string[] = [];
  for (const rawSegment of rawSegments) {
    const segment = decodePath(rawSegment);
    if (segment === undefined) return { reason: 'undecodable' };
    if (segment) segments.push(segment);
  }
  if (!segments.length) return undefined;

  const name = segments[0].toLowerCase();
  const normalized = normalizeLine([quoteSegment(name), ...segments.slice(1).map(quoteSegment)].join(' '));
  return 'reason' in normalized ? normalized : { ...normalized, name };
}

export function parseAddress(
  pathname: string,
  search: string,
  names: ReadonlySet<string> = routableCommandNames,
): AddressResult {
  const commandQuery = readCommandQuery(search);
  if (commandQuery.undecodable) return { kind: 'invalid', reason: 'undecodable' };

  const parsedPath = pathLine(pathname);
  if (parsedPath && commandQuery.value !== undefined) return { kind: 'invalid', reason: 'ambiguous' };
  if (parsedPath) {
    if ('reason' in parsedPath) return { kind: 'invalid', reason: parsedPath.reason };
    return names.has(parsedPath.name)
      ? { kind: 'command', line: parsedPath.line, form: 'path' }
      : { kind: 'not-command', line: parsedPath.line };
  }

  if (commandQuery.value === undefined || commandQuery.value === '') return { kind: 'root' };
  const normalized = normalizeLine(commandQuery.value);
  if ('reason' in normalized) return { kind: 'invalid', reason: normalized.reason };
  return { kind: 'command', line: normalized.line, form: 'query' };
}

export function toAddress(line: string, names: ReadonlySet<string> = routableCommandNames): string {
  const tokenized = tokenize(line);
  if ('tokens' in tokenized) {
    const values = tokenized.tokens.map((token) => token.value);
    if (
      values.length
      && tokenized.tokens.every((token) => token.type === 'WORD' && pathSafeToken.test(token.value) && !token.value.includes('.'))
      && names.has(values[0].toLowerCase())
    ) {
      return `/${values.map((value, index) => index === 0 ? value.toLowerCase() : value).join('/')}`;
    }
  }
  return `/?cmd=${encodeURIComponent(line).replaceAll('%20', '+')}`;
}

export function isTextClient(userAgent: string | null): boolean {
  return Boolean(userAgent && textClient.test(userAgent));
}

export function wantsColor(search: string): boolean {
  const params = new URLSearchParams(search);
  return !params.has('nocolor') && !params.has('no_color');
}
