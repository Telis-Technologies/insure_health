"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Nav = { group: string; href: string; label: string; icon: string; roles: string[] };
const NO_ROLES: string[] = [];
const nav: Nav[] = [
  { group: "Provider workspace", href: "/", label: "Overview", icon: "◫", roles: ["provider-biller"] },
  { group: "Provider workspace", href: "/claims", label: "Claims", icon: "▤", roles: ["provider-biller", "tpa-reviewer", "insurer-claims-adjudicator", "insurer-claims-approver", "tenant-admin"] },
  { group: "Provider workspace", href: "/claims/new", label: "New claim", icon: "+", roles: ["provider-biller", "tenant-admin"] },
  { group: "Provider workspace", href: "/members", label: "Members", icon: "○", roles: ["provider-biller", "tenant-admin"] },
  { group: "Provider workspace", href: "/policies", label: "Policies & benefits", icon: "▧", roles: ["provider-biller", "tpa-reviewer", "insurer-policy-author", "insurer-policy-approver", "tenant-admin"] },
  { group: "Provider workspace", href: "/providers", label: "Provider contracts", icon: "⌂", roles: ["provider-biller", "tenant-admin"] },
  { group: "Provider workspace", href: "/authorizations", label: "Authorizations", icon: "◉", roles: ["provider-biller", "tpa-reviewer", "insurer-claims-adjudicator", "tenant-admin"] },
  { group: "Adjudication", href: "/reviews", label: "Review queue", icon: "✓", roles: ["tpa-reviewer", "insurer-claims-adjudicator", "insurer-claims-approver", "tenant-admin"] },
  { group: "Adjudication", href: "/rules", label: "Policy & rules", icon: "≋", roles: ["tpa-reviewer", "insurer-policy-author", "insurer-policy-approver", "tenant-admin"] },
  { group: "Finance", href: "/settlements", label: "Settlements", icon: "↗", roles: ["insurer-finance", "tenant-admin"] },
  { group: "Finance", href: "/reports", label: "Operational reports", icon: "▥", roles: ["tpa-reviewer", "insurer-finance", "tenant-admin", "platform-admin"] },
  { group: "Administration", href: "/organization", label: "Organization admin", icon: "⚙", roles: ["tenant-admin"] },
  { group: "Administration", href: "/admin/tenants", label: "Tenant onboarding", icon: "▦", roles: ["platform-admin"] },
  { group: "Administration", href: "/access", label: "Users & access", icon: "⊙", roles: ["tenant-admin", "platform-admin"] },
  { group: "Administration", href: "/audit", label: "Audit history", icon: "◷", roles: ["provider-biller", "tpa-reviewer", "insurer-finance", "insurer-policy-author", "insurer-policy-approver", "tenant-admin", "platform-admin", "auditor"] },
];

function emitFeedback(message: string) {
  window.dispatchEvent(new CustomEvent("claimwise:feedback", { detail: message }));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const roles = session?.user?.roles ?? NO_ROLES;
  const groups = useMemo(() => {
    const visible = nav.filter((item) => item.roles.some((role) => roles.includes(role)));
    return [...new Set(visible.map((item) => item.group))].map((group) => ({ group, links: visible.filter((item) => item.group === group) }));
  }, [roles]);
  useEffect(() => {
    const show = (event: Event) => {
      setNotice((event as CustomEvent<string>).detail);
      window.setTimeout(() => setNotice(""), 4500);
    };
    window.addEventListener("claimwise:feedback", show);
    return () => window.removeEventListener("claimwise:feedback", show);
  }, []);
  useEffect(() => {
    if (status !== "authenticated" || pathname !== "/") return;
    const landing = roles.includes("platform-admin") ? "/admin/tenants" : roles.includes("tenant-admin") ? "/organization" : roles.includes("insurer-finance") ? "/settlements" : roles.includes("tpa-reviewer") || roles.includes("insurer-claims-adjudicator") || roles.includes("insurer-claims-approver") ? "/reviews" : roles.includes("insurer-policy-author") || roles.includes("insurer-policy-approver") ? "/rules" : roles.includes("auditor") ? "/audit" : "/claims";
    router.replace(landing);
  }, [pathname, roles, router, status]);

  if (pathname === "/login") return <>{children}</>;
  if (status === "loading") return <div className="auth-loading">Checking your secure session…</div>;
  if (status === "unauthenticated") return <div className="auth-gate"><div className="auth-card"><span className="brand-mark">C</span><p className="eyebrow">CLAIMWISE HEALTH</p><h1>Sign in to your workspace</h1><p>Continue with your organization account. Your role and organization access come from Keycloak.</p><button className="button button-primary" type="button" onClick={() => signIn("keycloak", { redirectTo: pathname || "/" })}>Continue with Keycloak <span>→</span></button><small>Users without an assigned Claimwise role cannot enter the application.</small></div></div>;

  const user = session?.user;
  const displayRole = roles.map((role) => role.replaceAll("-", " ")).join(" · ") || "No application role";
  const org = user?.organizationName || user?.organizationIds?.[0] || "Organization not assigned";
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Claimwise home"><span className="brand-mark">C</span><span className="brand-copy"><strong>claimwise</strong><small>HEALTH CLAIMS</small></span></Link>
        <div className="workspace-switcher"><span className="org-avatar">{org[0]?.toUpperCase() ?? "?"}</span><span className="workspace-copy"><small>ACTIVE ORGANIZATION</small><strong>{org}</strong></span><span className="chevron">⌄</span></div>
        <nav className="primary-nav" aria-label="Main navigation">{groups.map((group) => <section className="nav-group" key={group.group}><p className="nav-label">{group.group}</p>{group.links.map((item) => <Link className={`nav-link${pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)) ? " active" : ""}`} href={item.href} key={`${item.label}-${item.href}`}><span className="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></Link>)}</section>)}</nav>
        <div className="sidebar-bottom"><div className="help-card"><span className="help-icon">i</span><div><strong>Organization-scoped access</strong><p>Your menus reflect roles issued by your administrator.</p></div></div><button className="user-card user-card-button" type="button" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen}><span className="user-avatar">{(user?.name ?? user?.email ?? "U").slice(0, 1).toUpperCase()}</span><span className="user-copy"><strong>{user?.name ?? user?.email ?? "Signed-in user"}</strong><small>{displayRole}</small></span><span className="more">⌄</span></button></div>
      </aside>
      <div className="main-column"><header className="topbar"><div className="breadcrumbs"><span>Claimwise</span><span className="crumb-sep">/</span><strong>{displayRole}</strong></div><div className="topbar-actions"><span className="environment-pill"><i /> {org}</span><button className="icon-button" type="button" aria-label="Notifications" onClick={() => emitFeedback("No notifications are available for this account yet.")}>♧</button><button className="avatar-button" type="button" aria-label={`Signed in as ${user?.name ?? user?.email}. Open account menu`} title={`${user?.name ?? user?.email} · ${displayRole}`} onClick={() => setProfileOpen((open) => !open)}>{(user?.name ?? user?.email ?? "U").slice(0, 1).toUpperCase()}</button></div></header>
        {profileOpen ? <div className="profile-popover"><div className="profile-summary"><span className="user-avatar">{(user?.name ?? user?.email ?? "U").slice(0, 1).toUpperCase()}</span><div><strong>{user?.name ?? "Signed-in user"}</strong><small>{user?.email}</small><small>{displayRole}</small><small>{org}</small></div></div>{user?.tenantIds?.length ? <div className="identity-claims"><strong>Assigned tenant IDs</strong><small>{user.tenantIds.join(", ")}</small></div> : null}<button className="button button-outline signout-button" type="button" onClick={() => signOut({ redirectTo: "/login" })}>Sign out</button></div> : null}
        <main className="page-content">{children}</main><footer className="page-footer"><span>CLAIMWISE HEALTH</span><span>Keycloak identity · Access scoped by organization · API enforcement required</span></footer>
      </div>
      {notice ? <div className="app-toast" role="status" aria-live="polite"><span>i</span>{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div> : null}
    </div>
  );
}
