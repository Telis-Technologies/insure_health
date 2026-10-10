import { NextResponse } from "next/server";
import { auth } from "./auth";

const routeRoles: [string, string[]][] = [
  ["/admin/tenants", ["platform-admin"]],
  ["/organization", ["tenant-admin"]],
  ["/claims/new", ["provider-biller", "tenant-admin"]],
  ["/members", ["provider-biller", "tenant-admin"]],
  ["/policies", ["provider-biller", "tpa-reviewer", "insurer-policy-author", "insurer-policy-approver", "tenant-admin"]],
  ["/providers", ["provider-biller", "tenant-admin"]],
  ["/authorizations", ["provider-biller", "tpa-reviewer", "insurer-claims-adjudicator", "tenant-admin"]],
  ["/reviews", ["tpa-reviewer", "insurer-claims-adjudicator", "insurer-claims-approver", "tenant-admin"]],
  ["/settlements", ["insurer-finance", "tenant-admin"]],
  ["/rules", ["tpa-reviewer", "insurer-policy-author", "insurer-policy-approver", "tenant-admin"]],
  ["/reports", ["tpa-reviewer", "insurer-finance", "tenant-admin", "platform-admin"]],
  ["/audit", ["provider-biller", "tpa-reviewer", "insurer-finance", "insurer-policy-author", "insurer-policy-approver", "tenant-admin", "platform-admin", "auditor"]],
  ["/access", ["tenant-admin", "platform-admin"]],
  ["/claims", ["provider-biller", "tpa-reviewer", "insurer-claims-adjudicator", "insurer-claims-approver", "tenant-admin"]],
];

export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (!request.auth?.user) {
    const login = new URL("/login", request.nextUrl);
    login.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  if (pathname === "/forbidden") return NextResponse.next();
  const required = routeRoles.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1];
  const roles = request.auth.user.roles ?? [];
  if (roles.length === 0) return NextResponse.redirect(new URL("/forbidden", request.nextUrl));
  if (required && !required.some((role) => roles.includes(role))) return NextResponse.redirect(new URL("/forbidden", request.nextUrl));
  return NextResponse.next();
});

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
