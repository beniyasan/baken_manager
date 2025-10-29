import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { resolveSupabaseEnv } from "@/lib/supabaseEnv";

export { MissingSupabaseEnvError, isMissingSupabaseEnvError } from "@/lib/supabaseEnv";

export const createSupabaseRouteClient = async () => {
  const { supabaseUrl, supabaseAnonKey } = resolveSupabaseEnv();
  const cookieStore = cookies();
  return createRouteHandlerClient(
    { cookies: () => cookieStore },
    { supabaseUrl, supabaseKey: supabaseAnonKey },
  );
};
