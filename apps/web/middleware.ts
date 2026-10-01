import { parseAddress } from '@ahmed-moghazy/shared';
import { NextResponse, type NextRequest } from 'next/server';

function handleTextClient(_request: NextRequest): NextResponse | null {
  return null;
}

function rewriteHome(request: NextRequest, noindex = false): NextResponse {
  const response = NextResponse.rewrite(new URL(`/${request.nextUrl.search}`, request.url));
  if (noindex) response.headers.set('X-Robots-Tag', 'noindex');
  return response;
}

function handleBrowserRequest(request: NextRequest): NextResponse {
  const address = parseAddress(request.nextUrl.pathname, request.nextUrl.search);
  if (address.kind === 'command' && address.form === 'path') return rewriteHome(request);
  if (address.kind === 'not-command') return rewriteHome(request, true);
  if (address.kind === 'invalid') return rewriteHome(request, request.nextUrl.pathname !== '/');
  return NextResponse.next();
}

export function middleware(request: NextRequest): NextResponse {
  if (request.headers.get('next-router-prefetch') || request.headers.get('purpose') === 'prefetch') {
    return NextResponse.next();
  }
  const textClientResponse = handleTextClient(request);
  return textClientResponse ?? handleBrowserRequest(request);
}

export const config = {
  matcher: ['/((?!api/|_next/|.*\\.[^/]+$).*)'],
};
