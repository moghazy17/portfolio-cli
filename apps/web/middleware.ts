import { isTextClient, parseAddress, wantsColor } from '@ahmed-moghazy/shared';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { recordSurfaceEvent } from './lib/surface-stats';
import { readViewCookie } from './lib/view-cookie';

function handleTextClient(request: NextRequest): NextResponse | null {
  if (!isTextClient(request.headers.get('user-agent'))) return null;
  const { pathname, search } = request.nextUrl;
  // Vercel drops a valueless flag such as ?nocolor on the way to the route, so give it a value.
  const plain = wantsColor(search) ? '' : '&nocolor=1';
  return NextResponse.rewrite(new URL(`/api/term?__path=${encodeURIComponent(pathname)}&${search.slice(1)}${plain}`, request.url));
}

function rewriteHome(request: NextRequest, noindex = false): NextResponse {
  const response = NextResponse.rewrite(new URL(`/${request.nextUrl.search}`, request.url));
  if (noindex) response.headers.set('X-Robots-Tag', 'noindex');
  return response;
}

function handleBrowserRequest(request: NextRequest, event: NextFetchEvent): NextResponse {
  const { pathname, search } = request.nextUrl;
  // The regular page is a real route, not a deep link to the `gui` command.
  if (pathname === '/gui' || pathname === '/gui/') {
    if (request.headers.get('sec-fetch-dest') === 'document' || request.headers.get('rsc') === '1') {
      event.waitUntil(recordSurfaceEvent('gui_visits'));
    }
    return NextResponse.next();
  }
  if (pathname === '/' && search === '' && readViewCookie(request) === 'gui') {
    const response = NextResponse.redirect(new URL('/gui', request.url), 307);
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Vary', 'Cookie');
    return response;
  }
  const address = parseAddress(request.nextUrl.pathname, request.nextUrl.search);
  if (
    (address.kind === 'command' || address.kind === 'not-command')
    && request.headers.get('sec-fetch-dest') === 'document'
    && request.headers.get('sec-fetch-mode') === 'navigate'
  ) {
    event.waitUntil(recordSurfaceEvent('deep_links'));
  }
  if (address.kind === 'command' && address.form === 'path') return rewriteHome(request);
  if (address.kind === 'not-command') return rewriteHome(request, true);
  if (address.kind === 'invalid') return rewriteHome(request, request.nextUrl.pathname !== '/');
  return NextResponse.next();
}

export function middleware(request: NextRequest, event: NextFetchEvent): NextResponse {
  if (request.headers.get('next-router-prefetch') || request.headers.get('purpose') === 'prefetch') {
    return NextResponse.next();
  }
  const textClientResponse = handleTextClient(request);
  return textClientResponse ?? handleBrowserRequest(request, event);
}

export const config = {
  matcher: ['/((?!api/|_next/|.*\\.[^/]+$).*)'],
};
