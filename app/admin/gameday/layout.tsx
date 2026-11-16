import { requirePermissionPage } from "@/lib/auth/admin-guard";

export default async function GamedayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermissionPage("gameday");
  return <>{children}</>;
}
