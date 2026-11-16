import { requirePermissionPage } from "@/lib/auth/admin-guard";

export default async function PredictionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermissionPage("predictions");
  return <>{children}</>;
}
