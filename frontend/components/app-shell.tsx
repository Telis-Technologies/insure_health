"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { applicationRoles, navigation, roleLabels, rolesForPath } from "@/lib/access-policy";

const NO_ROLES: string[] = [];

function emitFeedback(message: string) {
  window.dispatchEvent(new CustomEvent("claimwise:feedback", { detail: message }));
}

export function AppShell({ children, identityIssuer, identityClientId }: { children: React.ReactNode; identityIssuer: string; identityClientId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [profileOpen, setProfileOpen] = useState<"top" | "sidebar" | null>(null);
  const [orgOpen, setOrgOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const orgRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const topProfileRef = useRef<HTMLButtonElement>(null);
  const sideProfileRef = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState("");
  const roles = useMemo(() => applicationRoles(session?.user?.roles ?? NO_ROLES), [session?.user?.roles]);
  const groups = useMemo(() => {
    const visible = navigation.filter((item) => rolesForPath(item.href)?.some((role) => roles.includes(role)));
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
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!orgRef.current?.contains(target)) setOrgOpen(false);
      if (!menuRef.current?.contains(target) && !topProfileRef.current?.contains(target) && !sideProfileRef.current?.contains(target)) {
        setProfileOpen(null);
        topProfileRef.current?.blur();
        sideProfileRef.current?.blur();
      }
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setProfileOpen(null); setOrgOpen(false); topProfileRef.current?.blur(); sideProfileRef.current?.blur(); } };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, []);

  async function leaveWorkspace() {
    setSigningOut(true);
    try {
      await signOut({ redirect: false });
      if (!identityIssuer || !identityClientId) { router.replace("/login?logged_out=1"); return; }
      const logout = new URL(`${identityIssuer.replace(/\/$/, "")}/protocol/openid-connect/logout`);
      logout.searchParams.set("client_id", identityClientId);
      logout.searchParams.set("post_logout_redirect_uri", `${window.location.origin}/login?logged_out=1`);
      window.location.assign(logout.toString());
    } catch {
      setSigningOut(false);
      emitFeedback("Sign-out could not finish. Please try again.");
    }
  }

  if (pathname === "/" || pathname === "/login") return <>{children}</>;
  if (status === "loading") return <div className="auth-loading">Checking your secure session…</div>;
  if (status === "unauthenticated") return <div className="auth-loading">Your session has ended. <Link href="/login">Sign in again</Link></div>;

  const user = session?.user;
  const displayRole = roles.map((role) => roleLabels[role]).join(" · ") || "No application role";
  const org = user?.organizationName || user?.organizationIds?.[0] || "Organization not assigned";
  const initials = (user?.name ?? user?.email ?? "U").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const profileMenu = <div className="account-menu" ref={menuRef} role="menu"><div className="account-menu-head"><span className="account-menu-avatar">{initials}</span><div><strong>{user?.name ?? "Signed-in user"}</strong><small>{user?.email}</small></div></div><div className="account-menu-meta"><span>ROLE <strong>{displayRole}</strong></span><span>ORGANIZATION <strong>{org}</strong></span></div><button className="account-menu-signout" type="button" onClick={leaveWorkspace} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out of this account"}<span aria-hidden="true">↗</span></button></div>;
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Claimwise home"><span className="brand-mark">C</span><span className="brand-copy"><strong>claimwise</strong><small>HEALTH CLAIMS</small></span></Link>
        <div className="organization-wrap" ref={orgRef}><button className="workspace-switcher" type="button" aria-expanded={orgOpen} onClick={() => { setOrgOpen((open) => !open); setProfileOpen(null); }}><span className="org-avatar">{org[0]?.toUpperCase() ?? "?"}</span><span className="workspace-copy"><small>ACTIVE ORGANIZATION</small><strong>{org}</strong></span><span className="chevron">⌄</span></button>{orgOpen ? <div className="organization-menu"><span className="menu-kicker">CURRENT CONTEXT</span><strong>{org}</strong><small>{user?.organizationIds?.join(" · ") || "No organization ID assigned"}</small><div className="organization-menu-foot">{user?.organizationIds?.length === 1 ? "One organization assigned" : `${user?.organizationIds?.length ?? 0} organizations assigned`}</div></div> : null}</div>
        <nav className="primary-nav" aria-label="Main navigation">{groups.map((group) => <section className="nav-group" key={group.group}><p className="nav-label">{group.group}</p>{group.links.map((item) => <Link className={`nav-link${pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)) ? " active" : ""}`} href={item.href} key={`${item.label}-${item.href}`} onClick={() => { setProfileOpen(null); setOrgOpen(false); }}><span className="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></Link>)}</section>)}</nav>
        <div className="sidebar-bottom"><button ref={sideProfileRef} className="user-card user-card-button" type="button" onClick={() => { setProfileOpen((open) => open === "sidebar" ? null : "sidebar"); setOrgOpen(false); }} aria-expanded={profileOpen === "sidebar"}><span className="user-avatar">{initials}</span><span className="user-copy"><strong>{user?.name ?? user?.email ?? "Signed-in user"}</strong><small>{displayRole}</small></span><span className="more">⌄</span></button>{profileOpen === "sidebar" ? profileMenu : null}</div>
      </aside>
      <div className="main-column"><header className="topbar"><div className="breadcrumbs"><span>Claimwise Health</span><span className="crumb-sep">/</span><strong>{displayRole}</strong></div><div className="topbar-actions"><span className="environment-pill"><i /> {org}</span><button className="icon-button" type="button" aria-label="Notifications" onClick={() => emitFeedback("No notifications are available for this account yet.")}>♧</button><button ref={topProfileRef} className="avatar-button" type="button" aria-label={`Signed in as ${user?.name ?? user?.email}. Open account menu`} aria-expanded={profileOpen === "top"} title={`${user?.name ?? user?.email} · ${displayRole}`} onClick={() => { setProfileOpen((open) => open === "top" ? null : "top"); setOrgOpen(false); }}>{initials}</button></div></header>
        {profileOpen === "top" ? <div className="top-account-menu">{profileMenu}</div> : null}
        <main className="page-content">{children}</main><footer className="page-footer"><span>CLAIMWISE HEALTH</span><span>Local reference workspace · Claims are not saved</span></footer>
      </div>
      {notice ? <div className="app-toast" role="status" aria-live="polite"><span>i</span>{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div> : null}
    </div>
  );
}
