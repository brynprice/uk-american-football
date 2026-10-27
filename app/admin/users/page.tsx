"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import ArchiveLayout from "@/components/archive/ArchiveLayout";
import {
  ALL_PERMISSIONS,
  PERMISSION_METADATA,
  PermissionKey,
  ROLE_PRESETS,
  UserRole,
} from "@/lib/auth/permissions";
import {
  listManagedUsersAction,
  createManagedUserAction,
  updateUserPermissionsAction,
  resetUserPasswordAction,
  deleteManagedUserAction,
  ManagedUserItem,
} from "./actions";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ManagedUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Create user form state
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("member");
  const [newPermissions, setNewPermissions] = useState<PermissionKey[]>(["poll"]);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
    roleLabel: string;
  } | null>(null);

  // Per-user draft edits: userId -> { role, permissions, displayName }
  const [drafts, setDrafts] = useState<
    Record<
      string,
      { role: UserRole; permissions: PermissionKey[]; displayName: string }
    >
  >({});

  // Password reset state: userId -> newPassword
  const [passwordResetId, setPasswordResetId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");

  const showToast = (
    text: string,
    type: "success" | "error" | "info" = "info"
  ) => {
    setToast({ text, type });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  async function loadUsers() {
    setIsLoading(true);
    const res = await listManagedUsersAction();
    if (res.success && res.users) {
      setUsers(res.users);
      const initialDrafts: Record<
        string,
        { role: UserRole; permissions: PermissionKey[]; displayName: string }
      > = {};
      for (const u of res.users) {
        initialDrafts[u.id] = {
          role: u.role,
          permissions: [...u.permissions],
          displayName: u.displayName,
        };
      }
      setDrafts(initialDrafts);
    } else {
      showToast(res.error || "Failed to load users", "error");
    }
    setIsLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
    let out = "";
    for (let i = 0; i < 12; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(out);
  };

  const applyPresetToNewUser = (presetId: string) => {
    const preset = ROLE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setNewRole(preset.role);
    setNewPermissions([...preset.permissions]);
  };

  const toggleNewPermission = (perm: PermissionKey) => {
    if (newRole === "admin") return;
    setNewPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createManagedUserAction({
        email: newEmail,
        password: newPassword,
        displayName: newDisplayName,
        role: newRole,
        permissions: newPermissions,
      });

      if (res.success) {
        setCreatedCredentials({
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
          roleLabel:
            newRole === "admin"
              ? "Super Admin"
              : newPermissions
                  .map((p) => PERMISSION_METADATA[p]?.shortLabel || p)
                  .join(", ") || "No tools assigned",
        });
        setNewEmail("");
        setNewDisplayName("");
        setNewPassword("");
        showToast("User account created!", "success");
        await loadUsers();
      } else {
        showToast(res.error || "Failed to create user", "error");
      }
    });
  };

  const updateDraftRole = (userId: string, role: UserRole) => {
    setDrafts((prev) => {
      const curr = prev[userId] || {
        role: "member",
        permissions: [],
        displayName: "",
      };
      return {
        ...prev,
        [userId]: {
          ...curr,
          role,
          permissions:
            role === "admin" ? [...ALL_PERMISSIONS] : curr.permissions,
        },
      };
    });
  };

  const applyPresetToUser = (userId: string, presetId: string) => {
    const preset = ROLE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDrafts((prev) => {
      const curr = prev[userId] || {
        role: "member",
        permissions: [],
        displayName: "",
      };
      return {
        ...prev,
        [userId]: {
          ...curr,
          role: preset.role,
          permissions: [...preset.permissions],
        },
      };
    });
  };

  const toggleDraftPermission = (userId: string, perm: PermissionKey) => {
    setDrafts((prev) => {
      const curr = prev[userId];
      if (!curr) return prev;
      // If user was admin and unchecks a box, switch them to scoped member with remaining permissions
      const baseRole: UserRole = "member";
      const hasPerm = curr.permissions.includes(perm);
      const nextPerms = hasPerm
        ? curr.permissions.filter((p) => p !== perm)
        : [...curr.permissions, perm];

      return {
        ...prev,
        [userId]: {
          ...curr,
          role: baseRole,
          permissions: nextPerms,
        },
      };
    });
  };

  const hasUnsavedChanges = (user: ManagedUserItem) => {
    const draft = drafts[user.id];
    if (!draft) return false;
    if (draft.role !== user.role) return true;
    if (draft.displayName !== user.displayName) return true;
    if (draft.permissions.length !== user.permissions.length) return true;
    const sortedA = [...draft.permissions].sort().join(",");
    const sortedB = [...user.permissions].sort().join(",");
    return sortedA !== sortedB;
  };

  const handleSaveUserPermissions = (userId: string) => {
    const draft = drafts[userId];
    if (!draft) return;

    startTransition(async () => {
      const res = await updateUserPermissionsAction({
        userId,
        role: draft.role,
        permissions: draft.permissions,
        displayName: draft.displayName,
      });

      if (res.success) {
        showToast("Updated user permissions!", "success");
        await loadUsers();
      } else {
        showToast(res.error || "Failed to update permissions", "error");
      }
    });
  };

  const handleResetPassword = (userId: string) => {
    if (!resetPasswordValue || resetPasswordValue.length < 6) {
      showToast("Password must be at least 6 characters.", "error");
      return;
    }
    startTransition(async () => {
      const res = await resetUserPasswordAction({
        userId,
        newPassword: resetPasswordValue,
      });
      if (res.success) {
        showToast("Password updated!", "success");
        setPasswordResetId(null);
        setResetPasswordValue("");
      } else {
        showToast(res.error || "Failed to reset password", "error");
      }
    });
  };

  const handleDeleteUser = (user: ManagedUserItem) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete user "${user.email}"?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteManagedUserAction(user.id);
      if (res.success) {
        showToast(`Deleted ${user.email}`, "info");
        await loadUsers();
      } else {
        showToast(res.error || "Failed to delete user", "error");
      }
    });
  };

  return (
    <ArchiveLayout>
      <div className="max-w-6xl mx-auto font-sans">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="text-blue-600 hover:underline text-xs font-bold uppercase tracking-widest mb-2 inline-block"
          >
            &larr; Back to Admin Dashboard
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter font-serif">
              User &amp; Permissions Manager
            </h1>
            <span className="bg-slate-900 text-amber-400 text-xs font-black uppercase px-2.5 py-1 border-2 border-slate-900">
              RBAC
            </span>
          </div>
          <p className="text-slate-600 text-sm mt-1">
            Invite Poll Voters, Gameday Contributors, or Archivists and assign
            granular access to individual admin tools.
          </p>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 px-5 py-3 border-2 border-slate-900 font-bold text-sm shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${
              toast.type === "success"
                ? "bg-emerald-400 text-slate-950"
                : toast.type === "error"
                ? "bg-rose-500 text-white"
                : "bg-slate-900 text-white"
            }`}
          >
            {toast.text}
          </div>
        )}

        {/* Section 1: Create New User */}
        <div className="bg-white border-2 border-slate-900 p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-4 mb-6 border-b-2 border-slate-900">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">
                Create / Invite User Account
              </h2>
              <p className="text-xs text-slate-500">
                Create an account with a role preset (e.g. Poll Voter) or pick
                custom tool permissions.
              </p>
            </div>

            {/* Quick Role Preset Buttons */}
            <div className="flex flex-wrap gap-1.5">
              {ROLE_PRESETS.map((preset) => {
                const isSelected =
                  newRole === preset.role &&
                  (preset.role === "admin" ||
                    (newPermissions.length === preset.permissions.length &&
                      preset.permissions.every((p) =>
                        newPermissions.includes(p)
                      )));
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPresetToNewUser(preset.id)}
                    className={`px-3 py-1.5 text-xs font-black uppercase border-2 border-slate-900 transition-all ${
                      isSelected
                        ? "bg-amber-400 text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Preset: {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="voter@example.com"
                  className="w-full border-2 border-slate-900 px-3 py-2 text-sm font-medium focus:outline-none focus:bg-amber-50/40"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Writer / Display Name
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g. Alex (Uniball Poll)"
                  className="w-full border-2 border-slate-900 px-3 py-2 text-sm font-medium focus:outline-none focus:bg-amber-50/40"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    Initial Password *
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[11px] font-black uppercase text-blue-600 hover:underline"
                  >
                    Generate Password
                  </button>
                </div>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full border-2 border-slate-900 px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:bg-amber-50/40"
                />
              </div>
            </div>

            {/* Account Level & Tool Checkboxes */}
            <div className="bg-slate-50 border-2 border-slate-200 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-600">
                    Account Type:
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="newRole"
                      checked={newRole === "member"}
                      onChange={() => setNewRole("member")}
                      className="accent-slate-900"
                    />
                    Scoped Contributor / Voter
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="newRole"
                      checked={newRole === "admin"}
                      onChange={() => {
                        setNewRole("admin");
                        setNewPermissions([...ALL_PERMISSIONS]);
                      }}
                      className="accent-slate-900"
                    />
                    Super Admin (All Tools + Delete Games + Manage Users)
                  </label>
                </div>
              </div>

              {newRole === "member" && (
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                    Allowed Admin Tools (Click to toggle):
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {ALL_PERMISSIONS.map((permKey) => {
                      const meta = PERMISSION_METADATA[permKey];
                      const checked = newPermissions.includes(permKey);
                      return (
                        <label
                          key={permKey}
                          className={`flex items-start gap-2 p-2.5 border-2 cursor-pointer transition-all select-none ${
                            checked
                              ? "bg-amber-100/90 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                              : "bg-white border-slate-200 text-slate-500 hover:border-slate-400"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleNewPermission(permKey)}
                            className="mt-0.5 accent-slate-900"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-900 leading-tight">
                              {meta.shortLabel}
                            </div>
                            <div className="text-[10px] text-slate-600 leading-tight mt-0.5">
                              {meta.href}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="bg-slate-900 text-white font-black uppercase text-xs tracking-wider px-6 py-3 border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(59,130,246,1)] hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {isPending ? "Creating User..." : "Create User Account"}
              </button>
            </div>
          </form>

          {/* Created Credentials Copy Box */}
          {createdCredentials && (
            <div className="mt-6 p-4 bg-emerald-50 border-2 border-emerald-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="text-xs space-y-1">
                <div className="font-black uppercase text-emerald-900">
                  Account Ready to Share
                </div>
                <div>
                  <span className="font-bold">Login URL:</span>{" "}
                  <code className="bg-white px-1.5 py-0.5 border border-emerald-200">
                    https://www.britball.io/login
                  </code>{" "}
                  &bull; <span className="font-bold">Email:</span>{" "}
                  <code className="bg-white px-1.5 py-0.5 border border-emerald-200">
                    {createdCredentials.email}
                  </code>{" "}
                  &bull; <span className="font-bold">Password:</span>{" "}
                  <code className="bg-white px-1.5 py-0.5 border border-emerald-200">
                    {createdCredentials.password}
                  </code>
                </div>
                <div className="text-emerald-800">
                  Assigned Access: <strong>{createdCredentials.roleLabel}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const text = `Britball Login: https://www.britball.io/login\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`;
                  await navigator.clipboard.writeText(text);
                  showToast("Copied login credentials to clipboard!", "success");
                }}
                className="bg-emerald-700 text-white text-xs font-black uppercase px-3 py-2 hover:bg-emerald-800 shrink-0"
              >
                Copy Credentials
              </button>
            </div>
          )}
        </div>

        {/* Section 2: Existing Users & Permissions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black uppercase italic tracking-tight font-serif">
              Existing Accounts ({users.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="bg-white border-2 border-slate-900 p-12 text-center text-slate-400 font-bold">
              Loading user accounts...
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => {
                const draft = drafts[user.id] || {
                  role: user.role,
                  permissions: user.permissions,
                  displayName: user.displayName,
                };
                const dirty = hasUnsavedChanges(user);

                return (
                  <div
                    key={user.id}
                    className="bg-white border-2 border-slate-900 p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-200">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-base text-slate-900">
                            {user.email}
                          </span>
                          {user.isCurrentUser && (
                            <span className="bg-blue-100 text-blue-800 border border-blue-300 text-[10px] font-black uppercase px-2 py-0.5 rounded">
                              You
                            </span>
                          )}
                          {draft.role === "admin" ? (
                            <span className="bg-amber-400 text-slate-950 border border-slate-900 text-[10px] font-black uppercase px-2 py-0.5">
                              Super Admin
                            </span>
                          ) : (
                            <span className="bg-slate-900 text-white text-[10px] font-black uppercase px-2 py-0.5">
                              Scoped Member ({draft.permissions.length}{" "}
                              {draft.permissions.length === 1 ? "Tool" : "Tools"})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                          <span>
                            Display Name:{" "}
                            <input
                              type="text"
                              value={draft.displayName}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [user.id]: {
                                    ...draft,
                                    displayName: e.target.value,
                                  },
                                }))
                              }
                              className="border-b border-slate-300 focus:border-slate-900 px-1 font-bold text-slate-800 focus:outline-none"
                            />
                          </span>
                          <span>&bull;</span>
                          <span>
                            Last sign-in:{" "}
                            {user.lastSignInAt
                              ? new Date(user.lastSignInAt).toLocaleDateString()
                              : "Never"}
                          </span>
                        </div>
                      </div>

                      {/* Quick Presets & Actions for this User */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!user.isCurrentUser &&
                          ROLE_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() =>
                                applyPresetToUser(user.id, preset.id)
                              }
                              className="px-2.5 py-1 text-[11px] font-bold uppercase border border-slate-300 bg-slate-50 hover:bg-slate-200 text-slate-700"
                            >
                              {preset.label}
                            </button>
                          ))}

                        <button
                          type="button"
                          onClick={() =>
                            setPasswordResetId(
                              passwordResetId === user.id ? null : user.id
                            )
                          }
                          className="px-2.5 py-1 text-[11px] font-bold uppercase border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                        >
                          Reset Password
                        </button>

                        {!user.isCurrentUser && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            disabled={isPending}
                            className="px-2.5 py-1 text-[11px] font-bold uppercase border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Password Reset Box */}
                    {passwordResetId === user.id && (
                      <div className="bg-slate-100 p-3 border border-slate-300 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">
                          New password for {user.email}:
                        </span>
                        <input
                          type="text"
                          value={resetPasswordValue}
                          onChange={(e) => setResetPasswordValue(e.target.value)}
                          placeholder="Min 6 characters"
                          className="border border-slate-400 bg-white px-2.5 py-1 text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleResetPassword(user.id)}
                          disabled={isPending}
                          className="bg-slate-900 text-white text-xs font-black uppercase px-3 py-1 hover:bg-blue-700"
                        >
                          Update Password
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordResetId(null);
                            setResetPasswordValue("");
                          }}
                          className="text-xs text-slate-500 hover:text-slate-900 px-2"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Permission Toggles */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                          Assigned Feature Permissions:
                        </span>
                        {!user.isCurrentUser && (
                          <div className="flex items-center gap-3 text-xs">
                            <button
                              type="button"
                              onClick={() => updateDraftRole(user.id, "admin")}
                              className={`font-bold hover:underline ${
                                draft.role === "admin"
                                  ? "text-amber-700 font-black"
                                  : "text-slate-500"
                              }`}
                            >
                              Grant Super Admin
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [user.id]: {
                                    ...draft,
                                    role: "member",
                                    permissions: ["poll"],
                                  },
                                }))
                              }
                              className="text-slate-500 hover:underline font-bold"
                            >
                              Poll Only
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {ALL_PERMISSIONS.map((permKey) => {
                          const meta = PERMISSION_METADATA[permKey];
                          const isChecked =
                            draft.role === "admin" ||
                            draft.permissions.includes(permKey);

                          return (
                            <button
                              key={permKey}
                              type="button"
                              disabled={user.isCurrentUser}
                              onClick={() =>
                                toggleDraftPermission(user.id, permKey)
                              }
                              className={`px-3 py-1.5 text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                isChecked
                                  ? "bg-slate-900 text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(251,191,36,1)]"
                                  : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-400 hover:text-slate-700"
                              } ${
                                user.isCurrentUser
                                  ? "opacity-90 cursor-default"
                                  : "cursor-pointer"
                              }`}
                            >
                              <span>{isChecked ? "✓" : "+"}</span>
                              <span>{meta.shortLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Unsaved changes bar */}
                    {dirty && (
                      <div className="pt-3 border-t border-slate-200 flex items-center justify-between bg-amber-50/70 -mx-5 -mb-5 px-5 py-3">
                        <span className="text-xs font-bold text-amber-900">
                          You have unsaved permission changes for {user.email}.
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setDrafts((prev) => ({
                                ...prev,
                                [user.id]: {
                                  role: user.role,
                                  permissions: [...user.permissions],
                                  displayName: user.displayName,
                                },
                              }))
                            }
                            className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5"
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveUserPermissions(user.id)}
                            disabled={isPending}
                            className="bg-emerald-600 text-white text-xs font-black uppercase px-4 py-1.5 border border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-emerald-700"
                          >
                            {isPending ? "Saving..." : "Save Permissions"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ArchiveLayout>
  );
}
