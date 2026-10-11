import { WorkspacePage } from "@/components/workspace-page";

export const instant = false;

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return <WorkspacePage slug={slug} />;
}
