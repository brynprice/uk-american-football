export const ALL_PERMISSIONS = [
  "poll",
  "gameday",
  "predictions",
  "proposals",
  "add_game",
  "walkovers",
  "set_coach",
  "anomalies",
  "game_counts",
  "champions",
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number];

export type UserRole = "admin" | "member";

export interface PermissionMeta {
  key: PermissionKey;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
  category: "live" | "archive";
}

export const PERMISSION_METADATA: Record<PermissionKey, PermissionMeta> = {
  poll: {
    key: "poll",
    label: "Uniball Writer's Poll",
    shortLabel: "Writer's Poll",
    description: "Build & save Top 25 ballots and view consensus writer rankings.",
    href: "/admin/poll",
    category: "live",
  },
  gameday: {
    key: "gameday",
    label: "Gameday Scoreboard",
    shortLabel: "Gameday",
    description: "Bulk score entry, walkovers, and instant standings updates.",
    href: "/admin/gameday",
    category: "live",
  },
  predictions: {
    key: "predictions",
    label: "Score Predictor",
    shortLabel: "Predictions",
    description: "Run H2H matchup simulations, weekly slates, and calibration stats.",
    href: "/admin/predictions",
    category: "live",
  },
  proposals: {
    key: "proposals",
    label: "Review Proposals",
    shortLabel: "Proposals",
    description: "Approve or reject crowd-sourced game update suggestions.",
    href: "/admin/proposals",
    category: "archive",
  },
  add_game: {
    key: "add_game",
    label: "Add Game Record",
    shortLabel: "Add Game",
    description: "Manually add historical game data, scores, venues, and staff.",
    href: "/admin/add-game",
    category: "archive",
  },
  walkovers: {
    key: "walkovers",
    label: "Walkover Manager",
    shortLabel: "Walkovers",
    description: "Resolve awarded games with missing scores or forfeit wins.",
    href: "/admin/walkovers",
    category: "archive",
  },
  set_coach: {
    key: "set_coach",
    label: "Coaching Manager",
    shortLabel: "Coaches",
    description: "Set head coaches for teams by season or individual game.",
    href: "/admin/set-coach",
    category: "archive",
  },
  anomalies: {
    key: "anomalies",
    label: "Anomalies Manager",
    shortLabel: "Anomalies",
    description: "Identify and resolve inconsistent game data or invalid entries.",
    href: "/admin/anomalies",
    category: "archive",
  },
  game_counts: {
    key: "game_counts",
    label: "Game Count Validator",
    shortLabel: "Game Counts",
    description: "Validate phase game counts and expected games per team.",
    href: "/admin/game-counts",
    category: "archive",
  },
  champions: {
    key: "champions",
    label: "Divisional Champions",
    shortLabel: "Champions",
    description: "Designate official division and conference champions.",
    href: "/admin/champions",
    category: "archive",
  },
};

export interface RolePreset {
  id: string;
  label: string;
  description: string;
  role: UserRole;
  permissions: PermissionKey[];
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    id: "poll_voter",
    label: "Poll Voter",
    description: "Access only to the Uniball Writer's Poll builder.",
    role: "member",
    permissions: ["poll"],
  },
  {
    id: "live_contributor",
    label: "Gameday & Poll Contributor",
    description: "Access to Writer's Poll, Gameday Scoreboard, and Score Predictor.",
    role: "member",
    permissions: ["poll", "gameday", "predictions"],
  },
  {
    id: "archivist",
    label: "Historical Archivist",
    description: "Access to archive management tools (games, coaches, champions, proposals).",
    role: "member",
    permissions: [
      "proposals",
      "add_game",
      "walkovers",
      "set_coach",
      "anomalies",
      "game_counts",
      "champions",
    ],
  },
  {
    id: "full_admin",
    label: "Super Admin",
    description: "Unrestricted access to all tools, game deletion, and user permissions.",
    role: "admin",
    permissions: [...ALL_PERMISSIONS],
  },
];

/**
 * Determines whether a Supabase user is a Super Admin.
 * Legacy admin accounts created prior to RBAC have no `app_metadata.role` and no `app_metadata.permissions`
 * and are preserved as full Super Admins so existing admins are never locked out.
 */
export function isSuperAdmin(user: { app_metadata?: Record<string, any> } | null | undefined): boolean {
  if (!user) return false;
  const meta = user.app_metadata || {};
  if (meta.role === "admin") return true;
  if (meta.role === "member") return false;
  if (Array.isArray(meta.permissions)) return false;
  return true;
}

export interface UserAccessProfile {
  userId: string;
  email: string;
  isAdmin: boolean;
  role: UserRole;
  permissions: PermissionKey[];
}

export function getUserAccess(
  user: { id?: string; email?: string; app_metadata?: Record<string, any> } | null | undefined
): UserAccessProfile {
  if (!user) {
    return {
      userId: "",
      email: "",
      isAdmin: false,
      role: "member",
      permissions: [],
    };
  }

  const admin = isSuperAdmin(user);
  if (admin) {
    return {
      userId: user.id || "",
      email: user.email || "",
      isAdmin: true,
      role: "admin",
      permissions: [...ALL_PERMISSIONS],
    };
  }

  const rawPerms = Array.isArray(user.app_metadata?.permissions)
    ? user.app_metadata!.permissions
    : [];
  const validPerms = rawPerms.filter((p: any): p is PermissionKey =>
    (ALL_PERMISSIONS as readonly string[]).includes(p)
  );

  return {
    userId: user.id || "",
    email: user.email || "",
    isAdmin: false,
    role: "member",
    permissions: validPerms,
  };
}

export function hasPermission(
  user: { id?: string; email?: string; app_metadata?: Record<string, any> } | null | undefined,
  permission: PermissionKey
): boolean {
  const access = getUserAccess(user);
  return access.isAdmin || access.permissions.includes(permission);
}

/**
 * Maps a request pathname under `/admin` or `/api/admin` to its required permission:
 * - `'admin_only'` if only Super Admins can access it (e.g. `/admin/users`)
 * - `PermissionKey` if a specific tool permission is required
 * - `'any_authenticated'` if any logged-in user can view it (e.g. `/admin` dashboard hub)
 */
export function getRequiredPermissionForPath(
  pathname: string
): PermissionKey | "admin_only" | "any_authenticated" | null {
  if (pathname === "/admin" || pathname === "/admin/") {
    return "any_authenticated";
  }
  if (pathname.startsWith("/admin/users")) {
    return "admin_only";
  }
  if (pathname.startsWith("/admin/poll")) {
    return "poll";
  }
  if (pathname.startsWith("/admin/gameday")) {
    return "gameday";
  }
  if (pathname.startsWith("/admin/predictions")) {
    return "predictions";
  }
  if (pathname.startsWith("/admin/proposals")) {
    return "proposals";
  }
  if (pathname.startsWith("/admin/add-game")) {
    return "add_game";
  }
  if (pathname.startsWith("/admin/walkovers")) {
    return "walkovers";
  }
  if (pathname.startsWith("/admin/set-coach")) {
    return "set_coach";
  }
  if (pathname.startsWith("/admin/anomalies")) {
    return "anomalies";
  }
  if (pathname.startsWith("/admin/game-counts") || pathname.startsWith("/api/admin/phases/update")) {
    return "game_counts";
  }
  if (pathname.startsWith("/admin/champions")) {
    return "champions";
  }
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return "admin_only";
  }
  return null;
}
