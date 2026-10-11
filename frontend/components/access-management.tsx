"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { roleLabels } from "@/lib/access-policy";

type Account = { username: string; name: string; role: string; organization: string; kind: "Insurer" | "Provider" | "TPA" | "Platform"; status: "Active" };
const accounts: Account[] = [
  { username: "lameck", name: "Lameck Administrator", role: "tenant-admin", organization: "Harbor Health Assurance", kind: "Insurer", status: "Active" },
  { username: "mercy.kamau", name: "Mercy Kamau", role: "insurer-claims-adjudicator", organization: "Harbor Health Assurance", kind: "Insurer", status: "Active" },
  { username: "peter.mutua", name: "Peter Mutua", role: "insurer-claims-approver", organization: "Harbor Health Assurance", kind: "Insurer", status: "Active" },
  { username: "faith.njeri", name: "Faith Njeri", role: "insurer-finance", organization: "Harbor Health Assurance", kind: "Insurer", status: "Active" },
  { username: "sarah.wambui", name: "Sarah Wambui", role: "insurer-policy-author", organization: "Harbor Health Assurance", kind: "Insurer", status: "Active" },
  { username: "david.ochieng", name: "David Ochieng", role: "insurer-policy-approver", organization: "Harbor Health Assurance", kind: "Insurer", status: "Active" },
  { username: "naomi.chebet", name: "Naomi Chebet", role: "auditor", organization: "Harbor Health Assurance", kind: "Insurer", status: "Active" },
  { username: "grace.wanjiku", name: "Grace Wanjiku", role: "provider-biller", organization: "Riverside Medical Centre", kind: "Provider", status: "Active" },
  { username: "joseph.otieno", name: "Joseph Otieno", role: "tpa-reviewer", organization: "MediBridge Administrators", kind: "TPA", status: "Active" },
  { username: "felix.mwangi", name: "Felix Mwangi", role: "platform-admin", organization: "Claimwise Platform", kind: "Platform", status: "Active" },
];

const capabilityRows = [
  { name: "Submit claims", roles: ["provider-biller"] },
  { name: "Review and request corrections", roles: ["tpa-reviewer", "insurer-claims-adjudicator"] },
  { name: "Approve an assessed claim", roles: ["insurer-claims-approver"] },
  { name: "Record payments and reconcile", roles: ["insurer-finance"] },
  { name: "Draft policy and rule versions", roles: ["insurer-policy-author"] },
  { name: "Approve and publish rules", roles: ["insurer-policy-approver"] },
  { name: "Manage tenant users and organizations", roles: ["tenant-admin"] },
  { name: "Onboard insurer tenants", roles: ["platform-admin"] },
  { name: "Read audit history", roles: ["auditor", "tenant-admin", "platform-admin"] },
];
const PAGE_SIZE = 5;

function initials(name: string) { return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase(); }

export function AccessManagement() {
  const { data: session } = useSession();
  const platform = session?.user?.roles?.includes("platform-admin") ?? false;
  const scopedAccounts = useMemo(() => accounts.filter((account) => platform || account.kind !== "Platform"), [platform]);
  const [query, setQuery] = useState("");
  const [organization, setOrganization] = useState("All organizations");
  const [role, setRole] = useState("All roles");
  const [view, setView] = useState<"users" | "permissions">("users");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Account | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ name: "", email: "", organization: "Harbor Health Assurance", role: "provider-biller" });
  const [feedback, setFeedback] = useState("");
  const organizations = useMemo(() => [...new Set(scopedAccounts.map((account) => account.organization))], [scopedAccounts]);
  const roles = useMemo(() => [...new Set(scopedAccounts.map((account) => account.role))], [scopedAccounts]);
  const filtered = useMemo(() => scopedAccounts.filter((account) => {
    const matchesQuery = `${account.name} ${account.username} ${account.organization} ${roleLabels[account.role]}`.toLowerCase().includes(query.toLowerCase().trim());
    return matchesQuery && (organization === "All organizations" || account.organization === organization) && (role === "All roles" || account.role === role);
  }).sort((a, b) => a.organization.localeCompare(b.organization) || roleLabels[a.role].localeCompare(roleLabels[b.role]) || a.name.localeCompare(b.name)), [scopedAccounts, query, organization, role]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const roleColumns = roles;

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setSelected(null); setInviteOpen(false); } };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, []);

  function unavailable(action: string) { setFeedback(`${action} requires the access-management API. No account or permission was changed.`); }
  function submitInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invite.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email)) { setFeedback("Enter a name and a valid email address."); return; }
    unavailable("Sending an invitation");
  }
  const displayedGroups = [...new Set(rows.map((account) => account.organization))];

  return <>
    <div className="access-heading"><div><div className="eyebrow">ADMINISTRATION / ACCESS CONTROL</div><h1>Users & access</h1><p className="page-subtitle">Review who belongs to each organization and what their role permits.</p></div><button className="button button-primary" type="button" onClick={() => { setInviteOpen(true); setFeedback(""); }}>＋ Invite user</button></div>
     <div className="access-summary"><article><span>Organizations</span><strong>{organizations.length}</strong><small>In this directory</small></article><article><span>Users</span><strong>{scopedAccounts.length}</strong><small>Assigned accounts</small></article><article><span>Roles</span><strong>{roles.length}</strong><small>Distinct role grants</small></article><article><span>Directory mode</span><strong className="access-source">Local snapshot</strong><small>Not yet synced with identity service</small></article></div>
    <div className="access-tabs" role="tablist" aria-label="Access management views"><button type="button" role="tab" aria-selected={view === "users"} className={view === "users" ? "selected" : ""} onClick={() => setView("users")}>Users <span>{scopedAccounts.length}</span></button><button type="button" role="tab" aria-selected={view === "permissions"} className={view === "permissions" ? "selected" : ""} onClick={() => setView("permissions")}>Roles & permissions</button></div>
    {view === "users" ? <>
      <section className="access-directory"><div className="access-directory-header"><div><h2>Organization directory</h2><p>Browse assigned accounts by organization, then role.</p></div><span className="status-pill status-reference">Local roster</span></div>
        <div className="access-organization-tabs" aria-label="Filter organizations"><button type="button" className={organization === "All organizations" ? "selected" : ""} onClick={() => { setOrganization("All organizations"); setPage(1); }}>All organizations <span>{scopedAccounts.length}</span></button>{organizations.map((name) => <button type="button" key={name} className={organization === name ? "selected" : ""} onClick={() => { setOrganization(name); setPage(1); }}>{name} <span>{scopedAccounts.filter((account) => account.organization === name).length}</span></button>)}</div>
        <div className="access-toolbar"><label><span>Search users</span><input type="search" placeholder="Name, username, role or organization" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></label><label><span>Role</span><select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}><option>All roles</option>{roles.map((item) => <option value={item} key={item}>{roleLabels[item]}</option>)}</select></label><button className="button button-outline" type="button" onClick={() => { setQuery(""); setRole("All roles"); setOrganization("All organizations"); setPage(1); }}>Clear filters</button></div>
        {rows.length ? displayedGroups.map((name) => <div className="access-organization-group" key={name}><div className="access-group-heading"><span className="access-group-mark">{name[0]}</span><div><strong>{name}</strong><small>{scopedAccounts.find((account) => account.organization === name)?.kind} organization</small></div></div>{[...new Set(rows.filter((account) => account.organization === name).map((account) => account.role))].map((groupRole) => <div key={groupRole}><div className="access-role-heading">{roleLabels[groupRole]} <span>{rows.filter((account) => account.organization === name && account.role === groupRole).length}</span></div><div className="access-user-list">{rows.filter((account) => account.organization === name && account.role === groupRole).map((account) => <button type="button" className="access-user-row" key={account.username} onClick={() => { setSelected(account); setFeedback(""); }}><span className="access-user-avatar">{initials(account.name)}</span><span className="access-user-primary"><strong>{account.name}</strong><small>@{account.username}</small></span><span className="access-user-role">{roleLabels[account.role]}</span><span className="access-user-status"><i /> {account.status}</span><span className="access-user-arrow">→</span></button>)}</div></div>)}</div>) : <div className="access-empty">No users match these filters. Try another name, organization or role.</div>}
        <div className="access-pagination"><span>Showing {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} users</span><div><button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>← Previous</button><span>Page {safePage} of {totalPages}</span><button type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>Next →</button></div></div>
      </section>
    </> : <section className="access-directory"><div className="access-directory-header"><div><h2>Role permissions</h2><p>Capabilities are separated by role. Publication and payment grants require explicit authority.</p></div></div><div className="table-scroll"><table className="permissions-table"><thead><tr><th>Capability</th>{roleColumns.map((item) => <th key={item}>{roleLabels[item]}</th>)}</tr></thead><tbody>{capabilityRows.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td>{roleColumns.map((item) => <td key={item}>{row.roles.includes(item) ? <span className="permission-yes" aria-label="Allowed">✓</span> : <span className="permission-no" aria-label="Not assigned">—</span>}</td>)}</tr>)}</tbody></table></div><div className="permission-footnote">A published rule requires an independent insurer-authorized approver. Tenant administration does not grant rule publication, review or finance access.</div></section>}
    {selected ? <div className="access-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside className="access-drawer" aria-label={`User details for ${selected.name}`}><div className="access-drawer-top"><span>USER DETAILS</span><button type="button" aria-label="Close user details" onClick={() => setSelected(null)}>×</button></div><div className="access-drawer-identity"><span className="access-user-avatar">{initials(selected.name)}</span><h2>{selected.name}</h2><p>@{selected.username}</p><span className="access-user-status"><i /> {selected.status}</span></div><dl><dt>Organization</dt><dd>{selected.organization}</dd><dt>Organization type</dt><dd>{selected.kind}</dd><dt>Assigned role</dt><dd>{roleLabels[selected.role]}</dd><dt>Permissions</dt><dd>{capabilityRows.filter((row) => row.roles.includes(selected.role)).map((row) => row.name).join(" · ") || "No direct workflow capability"}</dd></dl><div className="access-drawer-actions"><button type="button" onClick={() => unavailable("Changing a role")}>Change role</button><button type="button" onClick={() => unavailable("Suspending a user")}>Suspend access</button><button type="button" onClick={() => unavailable("Sending a password reset")}>Send password reset</button></div>{feedback ? <p className="access-feedback" role="status">{feedback}</p> : null}</aside></div> : null}
    {inviteOpen ? <div className="access-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setInviteOpen(false); }}><section className="access-invite" aria-label="Invite a user"><div className="access-drawer-top"><span>NEW USER</span><button type="button" aria-label="Close invitation form" onClick={() => setInviteOpen(false)}>×</button></div><h2>Invite a user</h2><p>Assign an organization and one role before sending an invitation.</p><form onSubmit={submitInvite}><label>Name<input value={invite.name} onChange={(event) => setInvite({ ...invite, name: event.target.value })} required /></label><label>Work email<input type="email" value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} required /></label><label>Organization<select value={invite.organization} onChange={(event) => setInvite({ ...invite, organization: event.target.value })}>{organizations.map((name) => <option key={name}>{name}</option>)}</select></label><label>Role<select value={invite.role} onChange={(event) => setInvite({ ...invite, role: event.target.value })}>{roles.filter((item) => platform || item !== "platform-admin").map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></label><button className="button button-primary" type="submit">Validate invitation</button></form>{feedback ? <p className="access-feedback" role="status">{feedback}</p> : null}</section></div> : null}
  </>;
}
