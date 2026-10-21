import { createClient } from "@/lib/supabase/server";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized: You must be logged in as an admin.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Asserts that the current request is from an authenticated admin.
 * Throws an UnauthorizedError if no authenticated user session exists.
 */
export async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedError();
  }

  return user;
}
