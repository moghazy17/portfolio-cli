import { isTextClient, parseAddress } from '@ahmed-moghazy/shared';
import { NextResponse, type NextRequest } from 'next/server';

function handleTextClient(request: NextRequest): NextResponse | null {
  if (!isTextClient(request.headers.get('user-agent'))) return null;
  const { pathname, search } = request.nextUrl;
  return NextResponse.rewrite(new URL(`/api/term?__path=${encodeURIComponent(pathname)}&${search.slice(1)}`, request.url));
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
