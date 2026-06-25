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
  } catch (error) {
    return NextResponse.redirect(new URL('/welcome', request.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
