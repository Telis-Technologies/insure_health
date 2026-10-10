import { LoginButton } from "@/components/login-button";

export const instant = false;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const { callbackUrl, error } = await searchParams;
  const configured = Boolean(process.env.AUTH_KEYCLOAK_ISSUER && process.env.AUTH_KEYCLOAK_ID);
  return <main className="auth-gate"><section className="auth-card"><span className="brand-mark">C</span><p className="eyebrow">CLAIMWISE HEALTH · SECURE ACCESS</p><h1>Sign in to your workspace</h1><p>Use your organization account. Your assigned role and organization access determine what you can see.</p>{error && <div className="auth-setup-warning" role="alert"><strong>Sign-in was not completed.</strong><span>Check your account details and retry. If this continues, ask your administrator to check your role and the Keycloak service.</span></div>}{configured ? <LoginButton callbackUrl={callbackUrl || "/"} /> : <div className="auth-setup-warning"><strong>Keycloak is not configured for this frontend yet.</strong><span>Start the Keycloak service, configure the OIDC client values in frontend/.env.local, then restart the frontend.</span></div>}<small>Access requires an enabled Keycloak account with a Claimwise application role and organization membership.</small></section></main>;
}
