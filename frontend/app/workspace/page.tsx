import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { applicationRoles, landingForRoles } from "@/lib/access-policy";

export const instant = false;

export default async function WorkspaceEntry() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (applicationRoles(session.user.roles ?? []).length === 0) redirect("/forbidden");
  redirect(landingForRoles(session.user.roles ?? []));
}
