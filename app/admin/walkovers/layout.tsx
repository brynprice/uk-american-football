import { requirePermissionPage } from "@/lib/auth/admin-guard";

export default async function WalkoversLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermissionPage("walkovers");
  return <>{children}</>;
}
