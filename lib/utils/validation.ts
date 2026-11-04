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
