const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that a value is a canonical UUID string.
 * Prevents PostgREST filter injection when interpolating IDs into `.or(...)` filter strings.
 */
export function isValidUuid(val: unknown): val is string {
  return typeof val === "string" && UUID_REGEX.test(val.trim());
}

/**
 * Ensures a redirect path is a safe internal relative path (starts with `/` and not `//` or `/\`).
 * Prevents Open Redirect vulnerabilities after login or destructive actions.
 */
export function sanitizeInternalRedirect(
  rawUrl: string | null | undefined,
  fallback = "/admin"
): string {
  if (!rawUrl || typeof rawUrl !== "string") return fallback;
  const trimmed = rawUrl.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("\0") ||
    trimmed.includes("\r") ||
    trimmed.includes("\n")
  ) {
    return fallback;
  }
  return trimmed;
}

/**
 * Checks whether a string is a valid HTTP or HTTPS URL.
 * Used before rendering external links in `<a href>` to prevent `javascript:` or `data:` XSS.
 */
export function isSafeHttpUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const VALID_GAME_STATUSES = new Set([
  "scheduled",
  "completed",
  "awarded",
  "postponed",
  "cancelled",
  "anomaly",
]);

export function isValidGameStatus(val: unknown): val is string {
  return typeof val === "string" && VALID_GAME_STATUSES.has(val);
}

export const VALID_FINAL_TYPES = new Set(["none", "title", "bowl"]);

export function isValidFinalType(val: unknown): val is string {
  return typeof val === "string" && VALID_FINAL_TYPES.has(val);
}

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Validates a strict calendar date in `YYYY-MM-DD` format.
 */
export function isValidIsoDate(val: unknown): val is string {
  if (typeof val !== "string") return false;
  const trimmed = val.trim();
  const match = ISO_DATE_REGEX.exec(trimmed);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1980 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

/**
 * Validates `HH:MM` or `HH:MM:SS` 24-hour time strings.
 */
export function isValidTimeString(val: unknown): val is string {
  return typeof val === "string" && TIME_REGEX.test(val.trim());
}

/**
 * Validates a non-negative integer football score within realistic archival bounds (0–300).
 */
export function isValidScore(val: unknown): val is number {
  return typeof val === "number" && Number.isInteger(val) && val >= 0 && val <= 300;
}

/**
 * Parses an optional score string or number into `number | null`, throwing if malformed or out of bounds.
 */
export function parseOptionalScore(val: unknown): number | null {
  if (val === undefined || val === null || val === "") return null;
  if (typeof val === "number") {
    if (!isValidScore(val)) {
      throw new Error("Score must be an integer between 0 and 300.");
    }
    return val;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (!/^\d+$/.test(trimmed)) {
      throw new Error("Score must be a non-negative integer.");
    }
    const parsed = Number(trimmed);
    if (!isValidScore(parsed)) {
      throw new Error("Score must be an integer between 0 and 300.");
    }
    return parsed;
  }
  throw new Error("Invalid score value.");
}

/**
 * Validates that a relative path is safe for cache revalidation (`/` prefix, no traversal or CRLF).
 */
export function isSafeInternalPath(val: unknown): val is string {
  if (typeof val !== "string") return false;
  const trimmed = val.trim();
  return (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.includes("..") &&
    !trimmed.includes("\0") &&
    !trimmed.includes("\r") &&
    !trimmed.includes("\n") &&
    trimmed.length <= 200
  );
}

/**
 * URL-encodes venue coordinates safely before embedding into a Google Maps query URL.
 */
export function encodeMapCoordinates(coordinates: string): string {
  return encodeURIComponent(coordinates.replace(/[()]/g, "").trim());
}
