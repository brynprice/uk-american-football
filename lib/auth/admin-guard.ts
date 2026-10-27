import { createClient } from "@/lib/supabase/server";
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
