import { requirePermissionPage } from "@/lib/auth/admin-guard";

export default async function AnomaliesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermissionPage("anomalies");
  return <>{children}</>;
}
