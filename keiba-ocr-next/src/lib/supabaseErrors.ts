import type { PostgrestError } from "@supabase/supabase-js";

type MinimalPostgrestError = Pick<PostgrestError, "code" | "message" | "details"> | null | undefined;

export function isUndefinedColumnError(error: MinimalPostgrestError, column: string): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "42703") {
    return true;
  }

  const haystack = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return haystack.includes("column") && haystack.includes(column.toLowerCase());
}

export function isUndefinedTableError(error: MinimalPostgrestError, table: string): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "42P01" || error.code === "PGRST116") {
    return true;
  }

  const haystack = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return haystack.includes(table.toLowerCase()) && haystack.includes("not") && haystack.includes("found");
}
