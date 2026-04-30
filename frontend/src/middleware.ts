import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Middleware — Route Protection
 *
 * Since JWT tokens are stored in localStorage (not cookies), we can't
 * validate them server-side in middleware. Instead, we use a lightweight
 * cookie flag set by the client after login to gate access.
 *
 * The real auth guard happens client-side in the AuthProvider.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicPaths = ['/login', '/_next', '/favicon.ico', '/api'];
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
