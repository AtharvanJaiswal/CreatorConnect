import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function buildContentSecurityPolicy(nonce: string, isDev: boolean, isHttps: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Dynamic React style attributes (zoom transform / upload bar width) & Next CSS runtime use inline styles.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    isDev ? "connect-src 'self' https: ws: wss:" : "connect-src 'self' https: wss:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  if (isHttps) {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
}

function applySecurityHeaders(
  response: NextResponse,
  cspHeader: string,
  isHttps: boolean,
): NextResponse {
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  );
  // Dynamic per-request nonces must never be cached across users or proxies.
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');

  if (isHttps) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
  }

  return response;
}

export function middleware(request: NextRequest) {
  const { pathname, protocol } = request.nextUrl;
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const isHttps = protocol === 'https:' || forwardedProto === 'https';
  const isDev = process.env.NODE_ENV !== 'production';

  const nonce = generateCspNonce();
  const cspHeader = buildContentSecurityPolicy(nonce, isDev, isHttps);

  // Intercept root path and any legacy non-admin routes; enforce server-side redirect to /admin/login
  if (pathname === '/' || (!pathname.startsWith('/admin') && !pathname.startsWith('/api'))) {
    const redirectResponse = NextResponse.redirect(new URL('/admin/login', request.url));
    return applySecurityHeaders(redirectResponse, cspHeader, isHttps);
  }

  // Forward nonce & CSP on request headers so Next.js 15 App Router attaches nonce to SSR scripts
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return applySecurityHeaders(response, cspHeader, isHttps);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api (API routes proxy)
     * - _next/static (static chunks)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
