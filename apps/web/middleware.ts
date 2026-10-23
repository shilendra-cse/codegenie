import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const signIn = new URL("/signin", request.url);
  signIn.searchParams.set(
    "next",
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: [
    "/welcome",
    "/inbox/:path*",
    "/new",
    "/projects/:path*",
    "/tasks/:path*",
  ],
};
