import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claimwise Health | Health claims, connected",
  description: "A connected health insurance claims workspace for providers and review teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
