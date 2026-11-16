import { requirePermissionPage } from "@/lib/auth/admin-guard";

export default async function PollLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermissionPage("poll");
  return <>{children}</>;
}
