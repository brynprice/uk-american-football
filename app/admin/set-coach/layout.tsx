import { requirePermissionPage } from "@/lib/auth/admin-guard";

export default async function SetCoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermissionPage("set_coach");
  return <>{children}</>;
}
