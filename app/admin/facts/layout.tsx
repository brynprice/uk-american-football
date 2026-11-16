import { requirePermissionPage } from "@/lib/auth/admin-guard";

export default async function FactsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermissionPage("facts");
  return <>{children}</>;
}
