import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeInternalRedirect } from "@/lib/utils/validation";
import {
  PermissionKey,
  PERMISSION_METADATA,
  isSuperAdmin,
  hasPermission,
  getUserAccess,
  ALL_PERMISSIONS,
} from "@/lib/auth/permissions";

export {
  ALL_PERMISSIONS,
  PERMISSION_METADATA,
  isSuperAdmin,
  hasPermission,
  getUserAccess,
};
export type { PermissionKey };

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized: You do not have permission to perform this action.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Asserts that the current request is from an authenticated Super Admin.
 * Throws an UnauthorizedError if no authenticated user session exists or if the user is a scoped member.
 */
export async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedError("Unauthorized: You must be logged in.");
  }

  if (!isSuperAdmin(user)) {
    throw new UnauthorizedError("Forbidden: Super Admin privileges are required.");
  }

  return user;
}

/**
 * Asserts that the current request is from an authenticated user who is either
 * a Super Admin or has been granted the specified tool permission.
 */
export async function assertPermission(permission: PermissionKey) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedError("Unauthorized: You must be logged in.");
  }

  if (!hasPermission(user, permission)) {
    const label = PERMISSION_METADATA[permission]?.label || permission;
    throw new UnauthorizedError(`Forbidden: Your account does not have access to ${label}.`);
  }

  return user;
}

/**
 * Server Component guard ensuring the requester has an active authenticated Supabase session.
 * Provides defense-in-depth alongside middleware/proxy checks.
 */
export async function requireAuthenticatedPage(redirectPath = "/admin") {
  const safeNext = sanitizeInternalRedirect(redirectPath, "/admin");
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(`/login?next=${encodeURIComponent(safeNext)}`);
  }

  return user;
}

/**
 * Server Component guard ensuring the requester is a Super Admin.
 */
export async function requireAdminPage(redirectPath = "/admin/users") {
  const user = await requireAuthenticatedPage(redirectPath);
  if (!isSuperAdmin(user)) {
    redirect("/admin?denied=admin_only");
  }
  return user;
}

/**
 * Server Component guard ensuring the requester holds a specific tool permission (or Super Admin).
 */
export async function requirePermissionPage(permission: PermissionKey, redirectPath?: string) {
  const targetPath = redirectPath || PERMISSION_METADATA[permission]?.href || "/admin";
  const user = await requireAuthenticatedPage(targetPath);
  if (!hasPermission(user, permission)) {
    redirect(`/admin?denied=${encodeURIComponent(permission)}`);
  }
  return user;
}
