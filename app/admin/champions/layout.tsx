import { requirePermissionPage } from "@/lib/auth/admin-guard";

export default async function ChampionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermissionPage("champions");
  return <>{children}</>;
}
