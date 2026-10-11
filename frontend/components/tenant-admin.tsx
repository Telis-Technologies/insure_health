"use client";

import { useState } from "react";

function tell(message: string) {
  window.dispatchEvent(new CustomEvent("claimwise:feedback", { detail: message }));
}

export function TenantOnboarding() {
  const [form, setForm] = useState({ insurer: "", registration: "", admin: "", tenantCode: "", region: "Kenya" });
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.insurer.trim() || !form.registration.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.admin) || !form.tenantCode.trim()) {
      setError("Enter the insurer legal name, registration reference, valid first-admin email and unique tenant code.");
      setSubmitted(false);
      return;
    }
    setError("");
    setSubmitted(true);
    tell("Onboarding details validated. Tenant creation and Keycloak user invitation require the platform onboarding API; nothing was provisioned or saved.");
  };
  return <>
    <div className="page-heading"><div><div className="eyebrow">PLATFORM ADMINISTRATION / TENANTS</div><h1>Tenant onboarding</h1><p className="page-subtitle">Provision an insurer workspace as an isolated tenant, then assign its first tenant administrator.</p></div></div>
    <div className="preview-note"><span className="preview-note-icon">i</span><span>Platform administrators can provision tenants. Tenant administrators only administer users and organization setup within their own insurer tenant.</span><strong>ONBOARDING</strong></div>
    <div className="onboarding-layout">
      <section className="panel"><div className="panel-header"><div><p className="panel-kicker">NEW INSURER TENANT</p><h2>Organization details</h2></div><span className="status-pill status-unavailable">Provisioning API pending</span></div>
        <form className="tenant-form" onSubmit={submit} noValidate>
          <label className="form-field"><span>Insurer legal name *</span><input value={form.insurer} onChange={e => setForm({ ...form, insurer: e.target.value })} placeholder="Example: Sample Health Assurance Ltd" required /></label>
          <label className="form-field"><span>Registration reference *</span><input value={form.registration} onChange={e => setForm({ ...form, registration: e.target.value })} placeholder="Insurer registration identifier" required /></label>
          <label className="form-field"><span>Tenant code *</span><input value={form.tenantCode} onChange={e => setForm({ ...form, tenantCode: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")} )} placeholder="sample-health" required /><small>Stable identifier used for tenant routing; cannot be changed after provisioning.</small></label>
          <label className="form-field"><span>First tenant administrator email *</span><input type="email" value={form.admin} onChange={e => setForm({ ...form, admin: e.target.value })} placeholder="admin@example.org" required /></label>
          <label className="form-field"><span>Data residency</span><select value={form.region} onChange={e => setForm({ ...form, region: e.target.value })}><option>Kenya</option><option>East Africa (to confirm)</option><option>Other (requires review)</option></select></label>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          {submitted ? <div className="form-info" role="status">Form validated. No tenant has been created because the provisioning API is not connected.</div> : null}
          <div className="form-actions"><span>Provisioning creates an insurer tenant, initial organization, admin invitation and audit event.</span><button className="button button-primary" type="submit">Validate onboarding <span>→</span></button></div>
        </form>
      </section>
      <aside className="panel onboarding-aside"><p className="panel-kicker">TENANT LIFECYCLE</p><h2>Separation by design</h2><ol className="appeal-steps"><li><strong>Provision insurer tenant</strong><span>Tenant ID is created once and cannot be supplied by ordinary users.</span></li><li><strong>Assign tenant administrator</strong><span>Invite through Keycloak; assign organization and tenant membership in the access service.</span></li><li><strong>Configure organizations</strong><span>Add provider and TPA organizations with explicit insurer contracts/delegation.</span></li><li><strong>Activate claims workflow</strong><span>Publish policies, tariffs and rules with versioned effective dates.</span></li></ol><div className="inline-callout"><span>ⓘ</span><p>Tenant isolation must be enforced in API queries and database constraints; this UI restriction alone is not a security boundary.</p></div></aside>
    </div>
    <section className="panel tenant-record-panel"><div className="panel-header"><div><p className="panel-kicker">TENANT REGISTER</p><h2>Provisioned insurer workspaces</h2></div><span className="muted-label">Live directory unavailable</span></div><div className="empty-api-state"><span className="empty-icon">▦</span><div><strong>No tenant register API is connected</strong><p>The seeded members and providers are synthetic preview records only; they are not tenant provisioning records.</p></div></div></section>
  </>;
}

export function OrganizationAdmin() {
  return <>
    <div className="page-heading"><div><div className="eyebrow">ORGANIZATION ADMINISTRATION</div><h1>Organization workspace</h1><p className="page-subtitle">Manage your insurer tenant’s users, organizations and delegated access—not other insurers’ data.</p></div></div>
    <div className="preview-note"><span className="preview-note-icon">i</span><span>Your active tenant comes from your Keycloak membership. Tenant admins cannot create other insurer tenants or publish policy versions unless separately authorized.</span><strong>SCOPED</strong></div>
    <div className="metric-grid"><article className="metric-card"><div className="metric-top"><span>Tenant</span><span className="metric-icon green">ID</span></div><strong className="metric-value">From identity</strong><span className="metric-meta">Keycloak tenant claim</span></article><article className="metric-card"><div className="metric-top"><span>Organizations</span><span className="metric-icon blue">ORG</span></div><strong className="metric-value">API required</strong><span className="metric-meta">Insurer · provider · TPA</span></article><article className="metric-card"><div className="metric-top"><span>Users</span><span className="metric-icon violet">USR</span></div><strong className="metric-value">API required</strong><span className="metric-meta">Organization memberships</span></article><article className="metric-card"><div className="metric-top"><span>Delegations</span><span className="metric-icon amber">ACL</span></div><strong className="metric-value">API required</strong><span className="metric-meta">Scoped TPA permissions</span></article></div>
    <section className="panel"><div className="panel-header"><div><p className="panel-kicker">TENANT ADMIN</p><h2>User and organization management</h2></div></div><div className="tenant-admin-actions"><div><strong>Invite a user</strong><p>Invitations should create a Keycloak identity and a separate tenant-scoped organization membership. Roles alone do not identify a tenant.</p></div><button className="button button-outline" type="button" onClick={() => tell("User invitation requires the access-management API. No invitation was sent.")}>Invite user <span>＋</span></button></div><div className="tenant-admin-actions"><div><strong>Manage organizations</strong><p>Maintain insurer, provider and TPA organization records, and connect them using contracts and scoped delegations.</p></div><button className="button button-outline" type="button" onClick={() => tell("Organization creation requires the access-management API. No organization was created.")}>Add organization <span>＋</span></button></div><div className="tenant-admin-actions"><div><strong>Review access changes</strong><p>All membership, role and delegation changes must be audited with actor, scope, reason and timestamp.</p></div><button className="button button-outline" type="button" onClick={() => tell("Access audit events are not available until the audit API is connected.")}>View access audit <span>↗</span></button></div></section>
  </>;
}
