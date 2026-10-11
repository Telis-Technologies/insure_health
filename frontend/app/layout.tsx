import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AuthProviders } from "@/components/auth-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claimwise Health | Claims workspace",
  description: "Health claims coordination for providers, insurers and administrators.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><AuthProviders><AppShell identityIssuer={process.env.AUTH_KEYCLOAK_ISSUER ?? ""} identityClientId={process.env.AUTH_KEYCLOAK_ID ?? ""}>{children}</AppShell></AuthProviders></body>
    </html>
  );
}
