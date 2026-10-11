import { NextResponse } from "next/server";
import { auth } from "./auth";
import { applicationRoles, rolesForPath } from "./lib/access-policy";

export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/" || pathname === "/login" || pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (!request.auth?.user) {
    const login = new URL("/login", request.nextUrl);
    login.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  if (pathname === "/forbidden") return NextResponse.next();
  const required = rolesForPath(pathname);
  const roles = applicationRoles(request.auth.user.roles ?? []);
  if (roles.length === 0) return NextResponse.redirect(new URL("/forbidden", request.nextUrl));
  if (pathname !== "/" && (!required || !required.some((role) => roles.includes(role)))) return NextResponse.redirect(new URL("/forbidden", request.nextUrl));
  return NextResponse.next();
});

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
