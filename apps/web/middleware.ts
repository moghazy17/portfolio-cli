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

const isTerminalHome = (pathname: string) => pathname === '/terminal' || pathname === '/terminal/';

/** Command links (`/projects`, `/?cmd=…`) and unknown paths run in the terminal page; the address bar keeps the link. */
function rewriteTerminal(request: NextRequest, noindex = false): NextResponse {
  const response = NextResponse.rewrite(new URL(`/terminal${request.nextUrl.search}`, request.url));
  if (noindex) response.headers.set('X-Robots-Tag', 'noindex');
  return response;
}

function handleBrowserRequest(request: NextRequest, event: NextFetchEvent): NextResponse {
  const { pathname, search } = request.nextUrl;
  // The regular page moved from /gui to /; old links (and their #window hash) land on it.
  if (pathname === '/gui' || pathname === '/gui/') {
    return NextResponse.redirect(new URL(`/${search}`, request.url), 308);
  }
  if (isTerminalHome(pathname)) return NextResponse.next();
  if (pathname === '/' && search === '') {
    // The desktop is the default; a visitor who last used the terminal goes back to it.
    if (readViewCookie(request) === 'terminal') {
      const response = NextResponse.redirect(new URL('/terminal', request.url), 307);
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.set('Vary', 'Cookie');
      return response;
    }
    if (request.headers.get('sec-fetch-dest') === 'document' || request.headers.get('rsc') === '1') {
      event.waitUntil(recordSurfaceEvent('gui_visits'));
    }
    return NextResponse.next();
  }
  const address = parseAddress(request.nextUrl.pathname, request.nextUrl.search);
  if (
    (address.kind === 'command' || address.kind === 'not-command')
    && request.headers.get('sec-fetch-dest') === 'document'
    && request.headers.get('sec-fetch-mode') === 'navigate'
  ) {
    event.waitUntil(recordSurfaceEvent('deep_links'));
  }
  if (address.kind === 'command') return rewriteTerminal(request);
  if (address.kind === 'not-command') return rewriteTerminal(request, true);
  if (address.kind === 'invalid') return rewriteTerminal(request, pathname !== '/');
  // `/` with unrelated query parameters (?utm_source=…) is still the desktop.
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
