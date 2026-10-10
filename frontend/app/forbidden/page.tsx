import Link from "next/link";

export default function ForbiddenPage() {
  return <main className="auth-gate"><section className="auth-card"><p className="eyebrow">ACCESS NOT GRANTED</p><h1>This workspace is not in your role scope</h1><p>Ask your organization administrator to review your Keycloak role and tenant membership. Access cannot be granted from this screen.</p><Link className="button button-outline" href="/login">Return to sign-in</Link></section></main>;
}
