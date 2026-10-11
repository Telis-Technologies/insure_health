/** Frontend route shaping. Data APIs must enforce these grants independently. */
export const roleLabels: Record<string, string> = {
  "platform-admin": "Platform administrator",
  "tenant-admin": "Organization administrator",
  "provider-biller": "Provider billing",
  "tpa-reviewer": "TPA reviewer",
  "insurer-claims-adjudicator": "Claims adjudicator",
  "insurer-claims-approver": "Claims approver",
  "insurer-finance": "Insurer finance",
  "insurer-policy-author": "Policy author",
  "insurer-policy-approver": "Policy approver",
  auditor: "Auditor",
};

export function applicationRoles(roles: string[] = []) {
  return roles.filter((role) => role in roleLabels);
}

export const routeAccess: Record<string, string[]> = {
  "/workspace": Object.keys(roleLabels),
  "/admin/tenants": ["platform-admin"],
  "/organization": ["tenant-admin"],
  "/access": ["tenant-admin", "platform-admin"],
  "/audit": ["tenant-admin", "platform-admin", "auditor"],
  "/claims/new": ["provider-biller"],
  "/claims": ["provider-biller", "tpa-reviewer", "insurer-claims-adjudicator", "insurer-claims-approver"],
  "/members": ["provider-biller"],
  "/policies": ["provider-biller", "tpa-reviewer", "insurer-policy-author", "insurer-policy-approver"],
  "/providers": ["provider-biller"],
  "/authorizations": ["provider-biller", "tpa-reviewer", "insurer-claims-adjudicator"],
  "/reviews": ["tpa-reviewer", "insurer-claims-adjudicator", "insurer-claims-approver"],
  "/rules": ["tpa-reviewer", "insurer-policy-author", "insurer-policy-approver"],
  "/settlements": ["insurer-finance"],
  "/reports": ["tpa-reviewer", "insurer-finance"],
};

export function landingForRoles(roles: string[]) {
  const granted = applicationRoles(roles);
  if (granted.includes("platform-admin")) return "/admin/tenants";
  if (granted.includes("tenant-admin")) return "/organization";
  if (granted.includes("insurer-finance")) return "/settlements";
  if (granted.some((role) => ["tpa-reviewer", "insurer-claims-adjudicator", "insurer-claims-approver"].includes(role))) return "/reviews";
  if (granted.some((role) => ["insurer-policy-author", "insurer-policy-approver"].includes(role))) return "/rules";
  if (granted.includes("auditor")) return "/audit";
  return "/claims";
}

export function rolesForPath(pathname: string) {
  const path = Object.keys(routeAccess)
    .sort((left, right) => right.length - left.length)
    .find((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`));
  return path ? routeAccess[path] : undefined;
}

export const navigation = [
  { group: "Claims", href: "/claims", label: "Claims", icon: "▤" },
  { group: "Provider billing", href: "/claims/new", label: "New claim", icon: "+" },
  { group: "Provider billing", href: "/members", label: "Members", icon: "○" },
  { group: "Coverage", href: "/policies", label: "Policies & benefits", icon: "▧" },
  { group: "Provider billing", href: "/providers", label: "Provider contracts", icon: "⌂" },
  { group: "Coverage", href: "/authorizations", label: "Authorizations", icon: "◉" },
  { group: "Adjudication", href: "/reviews", label: "Review queue", icon: "✓" },
  { group: "Adjudication", href: "/rules", label: "Policy & rules", icon: "≋" },
  { group: "Finance", href: "/settlements", label: "Settlements", icon: "↗" },
  { group: "Finance", href: "/reports", label: "Operational reports", icon: "▥" },
  { group: "Administration", href: "/organization", label: "Organization admin", icon: "⚙" },
  { group: "Administration", href: "/admin/tenants", label: "Tenant onboarding", icon: "▦" },
  { group: "Administration", href: "/access", label: "Users & access", icon: "⊙" },
  { group: "Administration", href: "/audit", label: "Audit history", icon: "◷" },
];
