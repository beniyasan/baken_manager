"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

let client: SupabaseClient<Database> | null = null;

export const getSupabaseBrowserClient = (): SupabaseClient<Database> => {
  if (!client) {
    client = createClientComponentClient<Database>();
  }
  return client;
};

export const supabaseClient = getSupabaseBrowserClient();
