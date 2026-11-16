"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { assertAdmin, UnauthorizedError } from "@/lib/auth/admin-guard";
import { isValidUuid } from "@/lib/utils/validation";
import {
  ALL_PERMISSIONS,
  PermissionKey,
  UserRole,
  getUserAccess,
} from "@/lib/auth/permissions";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateAdminPassword(password: string): string | null {
  if (!password || password.length < 12) {
    return "Password must be at least 12 characters long.";
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    return "Password must include uppercase, lowercase, and numeric characters.";
  }
  return null;
}

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase Service Role configuration.");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export interface ManagedUserItem {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastSignInAt: string | null;
  isAdmin: boolean;
  role: UserRole;
  permissions: PermissionKey[];
  isCurrentUser: boolean;
}

export async function listManagedUsersAction(): Promise<{
  success: boolean;
  users?: ManagedUserItem[];
  currentUserId?: string;
  error?: string;
}> {
  try {
    const currentAdmin = await assertAdmin();
    const supabase = getServiceClient();

    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    const users: ManagedUserItem[] = (data.users || []).map((u) => {
      const access = getUserAccess(u);
      const displayName =
        u.user_metadata?.display_name ||
        u.user_metadata?.name ||
        (u.email ? u.email.split("@")[0] : "User");

      return {
        id: u.id,
        email: u.email || "No email",
        displayName,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at || null,
        isAdmin: access.isAdmin,
        role: access.role,
        permissions: access.permissions,
        isCurrentUser: u.id === currentAdmin.id,
      };
    });

    // Sort: current user first, then Super Admins, then alphabetically by email
    users.sort((a, b) => {
      if (a.isCurrentUser && !b.isCurrentUser) return -1;
      if (!a.isCurrentUser && b.isCurrentUser) return 1;
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      return a.email.localeCompare(b.email);
    });

    return {
      success: true,
      users,
      currentUserId: currentAdmin.id,
    };
  } catch (err: any) {
    console.error("listManagedUsersAction error:", err);
    if (err instanceof UnauthorizedError) {
      return { success: false, error: err.message };
    }
    return {
      success: false,
      error: "Failed to fetch users.",
    };
  }
}

export async function createManagedUserAction(payload: {
  email: string;
  password: string;
  displayName?: string;
  role: UserRole;
  permissions: PermissionKey[];
}): Promise<{ success: boolean; user?: ManagedUserItem; error?: string }> {
  try {
    await assertAdmin();
    const supabase = getServiceClient();

    const cleanEmail = (payload.email || "").trim().toLowerCase();
    const password = payload.password || "";

    if (!cleanEmail || cleanEmail.length > 254 || !EMAIL_REGEX.test(cleanEmail)) {
      return { success: false, error: "Please provide a valid email address." };
    }
    if (payload.role !== "admin" && payload.role !== "member") {
      return { success: false, error: "Invalid user role." };
    }
    if (payload.displayName && payload.displayName.trim().length > 100) {
      return { success: false, error: "Display name must be under 100 characters." };
    }
    const pwError = validateAdminPassword(password);
    if (pwError) {
      return { success: false, error: pwError };
    }

    const sanitizedPerms =
      payload.role === "admin"
        ? [...ALL_PERMISSIONS]
        : (payload.permissions || []).filter((p): p is PermissionKey =>
            (ALL_PERMISSIONS as readonly string[]).includes(p)
          );

    const { error } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: payload.displayName?.trim() || cleanEmail.split("@")[0],
      },
      app_metadata: {
        role: payload.role,
        permissions: sanitizedPerms,
      },
    });

    if (error) {
      throw error;
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: any) {
    console.error("createManagedUserAction error:", err);
    if (err instanceof UnauthorizedError) {
      return { success: false, error: err.message };
    }
    return {
      success: false,
      error: "Failed to create user account. Verify the email is not already registered.",
    };
  }
}

export async function updateUserPermissionsAction(payload: {
  userId: string;
  role: UserRole;
  permissions: PermissionKey[];
  displayName?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const currentAdmin = await assertAdmin();

    if (!isValidUuid(payload.userId)) {
      return { success: false, error: "Invalid user ID." };
    }
    if (payload.role !== "admin" && payload.role !== "member") {
      return { success: false, error: "Invalid user role." };
    }
    if (payload.displayName && payload.displayName.trim().length > 100) {
      return { success: false, error: "Display name must be under 100 characters." };
    }

    const supabase = getServiceClient();

    if (payload.userId === currentAdmin.id && payload.role !== "admin") {
      return {
        success: false,
        error: "You cannot remove Super Admin privileges from your own account.",
      };
    }

    const sanitizedPerms =
      payload.role === "admin"
        ? [...ALL_PERMISSIONS]
        : (payload.permissions || []).filter((p): p is PermissionKey =>
            (ALL_PERMISSIONS as readonly string[]).includes(p)
          );

    const updateAttributes: Record<string, any> = {
      app_metadata: {
        role: payload.role,
        permissions: sanitizedPerms,
      },
    };

    if (payload.displayName !== undefined) {
      updateAttributes.user_metadata = {
        display_name: payload.displayName.trim(),
      };
    }

    const { error } = await supabase.auth.admin.updateUserById(
      payload.userId,
      updateAttributes
    );

    if (error) {
      throw error;
    }

    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    console.error("updateUserPermissionsAction error:", err);
    if (err instanceof UnauthorizedError) {
      return { success: false, error: err.message };
    }
    return {
      success: false,
      error: "Failed to update user permissions.",
    };
  }
}

export async function resetUserPasswordAction(payload: {
  userId: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdmin();

    if (!isValidUuid(payload.userId)) {
      return { success: false, error: "Invalid user ID." };
    }
    const pwError = validateAdminPassword(payload.newPassword);
    if (pwError) {
      return { success: false, error: pwError };
    }

    const supabase = getServiceClient();

    const { error } = await supabase.auth.admin.updateUserById(payload.userId, {
      password: payload.newPassword,
    });

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (err: any) {
    console.error("resetUserPasswordAction error:", err);
    if (err instanceof UnauthorizedError) {
      return { success: false, error: err.message };
    }
    return {
      success: false,
      error: "Failed to reset password.",
    };
  }
}

export async function deleteManagedUserAction(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentAdmin = await assertAdmin();

    if (!isValidUuid(userId)) {
      return { success: false, error: "Invalid user ID." };
    }

    const supabase = getServiceClient();

    if (userId === currentAdmin.id) {
      return {
        success: false,
        error: "You cannot delete your own Super Admin account.",
      };
    }

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      throw error;
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: any) {
    console.error("deleteManagedUserAction error:", err);
    if (err instanceof UnauthorizedError) {
      return { success: false, error: err.message };
    }
    return {
      success: false,
      error: "Failed to delete user.",
    };
  }
}
