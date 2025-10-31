import type { PostgrestError } from "@supabase/supabase-js";

export function isUndefinedColumnError(
  error: Pick<PostgrestError, "code" | "message" | "details"> | null | undefined,
  column: string,
): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "42703") {
    return true;
  }

  const haystack = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return haystack.includes("column") && haystack.includes(column.toLowerCase());
}
