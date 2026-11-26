import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

import { isMentorPath, MENTOR_HEADER, MENTOR_HOME } from './lib/mentor-header';

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

  let mentor = false;
  try {
    const { payload } = await jwtVerify(session, SECRET);
    mentor = typeof payload.mentorId === 'string';
  } catch {
    return NextResponse.redirect(new URL('/welcome', request.url));
  }

  // Never trust this header from a browser: only a mentor's session sets it.
  const headers = new Headers(request.headers);
  headers.delete(MENTOR_HEADER);
  if (!mentor) return NextResponse.next({ request: { headers } });

  // A mentor has pages of their own (app/mentor) built from the student's
  // schedule, logs, reports and progress, and never opens the student's pages.
  if (!isMentorPath(pathname)) {
    return NextResponse.redirect(new URL(MENTOR_HOME, request.url));
  }
  // Marks the request so lib/mentor-guard.ts refuses any write a server action attempts.
  headers.set(MENTOR_HEADER, '1');
  return NextResponse.next({ request: { headers } });
}


export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
