import { requirePermissionPage } from "@/lib/auth/admin-guard";

export default async function ProposalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermissionPage("proposals");
  return <>{children}</>;
}
