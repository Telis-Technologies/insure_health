import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AuthProviders } from "@/components/auth-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claimwise Health | Claims workspace",
  description: "Synthetic health insurance claims workflow preview.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><AuthProviders><AppShell>{children}</AppShell></AuthProviders></body>
    </html>
  );
}
