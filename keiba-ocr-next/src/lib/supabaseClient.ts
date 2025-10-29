"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveSupabaseEnv } from "@/lib/supabaseEnv";

let client: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (client) {
    return client;
  }

  const { supabaseUrl, supabaseAnonKey } = resolveSupabaseEnv();
  client = createClientComponentClient({
    supabaseUrl,
    supabaseKey: supabaseAnonKey,
  });

  return client;
};

export const supabaseClient = getSupabaseClient();
