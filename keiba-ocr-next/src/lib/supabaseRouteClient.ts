import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { debugLog, safePrefix } from "./debug";

export function createSupabaseRouteClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!anon) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const jar = cookies();
  const cookieNames = jar.getAll().map((c) => c.name);

  debugLog("route init", {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_prefix: safePrefix(anon),
    cookieNames,
  });

  return createServerClient(url, anon, {
    cookies: {
      get: (name: string) => jar.get(name)?.value,
      set() {},
      remove() {},
    },
  });
}
