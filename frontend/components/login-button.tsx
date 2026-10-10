"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function LoginButton({ callbackUrl }: { callbackUrl: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function startSignIn() {
    setPending(true);
    setError(false);
    try {
      await signIn("keycloak", { redirectTo: callbackUrl });
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return <>
    <button className="button button-primary" type="button" disabled={pending} onClick={startSignIn}>
      {pending ? "Opening Keycloak…" : "Continue with Keycloak"} <span aria-hidden="true">→</span>
    </button>
    {error && <p role="alert">Could not open Keycloak. Check that it is running on localhost:8080, then try again.</p>}
  </>;
}
