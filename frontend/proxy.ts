import { NextResponse, type NextRequest } from "next/server";

export default function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && !request.nextUrl.pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (request.nextUrl.pathname !== "/" && request.nextUrl.pathname !== "/providers" && request.nextUrl.pathname !== "/providers/reviewer") return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
