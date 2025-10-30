import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export const createSupabaseRouteClient = (): SupabaseClient<Database> =>
  createRouteHandlerClient<Database>({ cookies }) as unknown as SupabaseClient<Database>;
