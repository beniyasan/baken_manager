import { createClient } from "@supabase/supabase-js";
import { debugLog, safePrefix } from "./debug";

let cached: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdminClient() {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing env: SUPABASE_URL");
  if (!key) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

  debugLog("admin init", {
    SUPABASE_URL: url,
    SERVICE_ROLE_KEY_prefix: safePrefix(key),
  });

  cached = createClient(url, key, {
    auth: { persistSession: false },
  });
  return cached;
}
