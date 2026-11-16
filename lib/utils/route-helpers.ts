import { notFound } from "next/navigation";
import { isValidUuid } from "@/lib/utils/validation";

/**
 * Triggers Next.js 404 early when a dynamic UUID route parameter is malformed,
 * avoiding unnecessary database queries and 500 errors from bot probes.
 */
export function assertValidUuidOrNotFound(...ids: string[]): void {
  for (const id of ids) {
    if (!isValidUuid(id)) {
      notFound();
    }
  }
}

/**
 * Runs an ArchiveService fetch and converts missing-record errors into a Next.js 404.
 */
export async function fetchOrNotFound<T>(fn: () => Promise<T>): Promise<T> {
  try {
    const result = await fn();
    if (!result) {
      notFound();
    }
    return result;
  } catch (err: unknown) {
    const errObj =
      err && typeof err === "object"
        ? (err as { code?: unknown; message?: unknown })
        : null;
    if (
      errObj?.code === "PGRST116" ||
      (typeof errObj?.message === "string" &&
        errObj.message.toLowerCase().includes("not found"))
    ) {
      notFound();
    }
    throw err;
  }
}
