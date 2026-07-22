import { type NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

/**
 * One app serves two things:
 *   - the customer storefront SPA (Expo web export) at `/` and its assets
 *     (`/_expo/*`, `/assets/*`, `/index.html`) — all PUBLIC.
 *   - the admin app under `/admin/*` (protected), plus the shared `/api/*`.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public API + media + (implicitly) storefront assets pass straight through.
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/brand') ||
    pathname.startsWith('/api/shop') ||
    pathname.startsWith('/uploads/') ||
    pathname.startsWith('/seed/')
  ) {
    return NextResponse.next();
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  // Remaining API routes require a session; DELETE is admin-only.
  if (pathname.startsWith('/api/')) {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (req.method === 'DELETE' && session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Admin login page: public, but bounce an already-signed-in user to the dashboard.
  if (pathname === '/admin/login') {
    if (session) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Everything else under /admin requires a session.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // The storefront SPA at `/` and its static assets are public.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
