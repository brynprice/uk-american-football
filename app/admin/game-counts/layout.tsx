import { requirePermissionPage } from "@/lib/auth/admin-guard";

export default async function GameCountsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermissionPage("game_counts");
  return <>{children}</>;
}
