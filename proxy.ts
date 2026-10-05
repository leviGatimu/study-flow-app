import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is not set. Add a strong random value to your .env file.'
  );
}

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const PUBLIC_PATHS = ['/welcome', '/login', '/register', '/api/auth'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Uploaded files are private. On a dev or web build they can sit in
  // public/uploads, where Next would serve them as static files to anyone -
  // even signed out, since the rule below lets any path with a dot through.
  // Middleware runs before static files, so every /uploads URL is rewritten to
  // the route that checks the session (cookie or device bearer) AND that the
  // file belongs to one of the caller's records. The public URL is unchanged.
  if (pathname.startsWith('/uploads/')) {
    return NextResponse.rewrite(new URL(`/api${pathname}${request.nextUrl.search}`, request.url));
  }

  // Allow static assets and public paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/public') ||
    pathname.includes('.') ||
    PUBLIC_PATHS.some(path => pathname.startsWith(path))
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get('session')?.value;

  if (!session) {
    return NextResponse.redirect(new URL('/welcome', request.url));
  }

  try {
    await jwtVerify(session, SECRET);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/welcome', request.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
