import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { debugLog, safePrefix } from "./debug";
import type { Database } from "@/types/database";

export function createSupabaseRouteClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!anon) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const jar = cookies();
  const cookieNames = jar.getAll().map((c) => c.name);

  debugLog("route init", {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_prefix: safePrefix(anon),
    cookieNames,
  });

  return createRouteHandlerClient<Database>(
    { cookies: () => jar },
    {
      supabaseUrl: url,
      supabaseKey: anon,
    }
  );
}
