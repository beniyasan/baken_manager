"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export const supabaseClient =
  createClientComponentClient<Database>() as unknown as SupabaseClient<Database>;

export const getSupabaseBrowserClient = () => supabaseClient;
