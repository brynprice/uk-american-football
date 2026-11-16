import { requireAuthenticatedPage } from "@/lib/auth/admin-guard";

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthenticatedPage("/admin");
  return <>{children}</>;
}
