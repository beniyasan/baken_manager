import { createClient } from "@supabase/supabase-js";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

let adminClient: SupabaseClient<Database> | null = null;

export const getSupabaseAdminClient = (): SupabaseClient<Database> => {
  if (adminClient) {
    return adminClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません");
  }

  adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  return adminClient;
};
