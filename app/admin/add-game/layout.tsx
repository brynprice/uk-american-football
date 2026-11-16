import { requirePermissionPage } from "@/lib/auth/admin-guard";

export default async function AddGameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermissionPage("add_game");
  return <>{children}</>;
}
