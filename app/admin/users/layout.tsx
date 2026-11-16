import { requireAdminPage } from "@/lib/auth/admin-guard";

export default async function AdminUsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage("/admin/users");
  return <>{children}</>;
}
