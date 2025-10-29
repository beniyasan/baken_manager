import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export class MissingSupabaseEnvError extends Error {
  constructor(missingKeys: string[]) {
    const messageBase =
      "Supabase の接続情報が見つかりません。NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY を設定してください。";
    super(missingKeys.length ? `${messageBase} (不足: ${missingKeys.join(", ")})` : messageBase);
    this.name = "MissingSupabaseEnvError";
  }
}

type SupabaseEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

const resolveSupabaseEnv = (): SupabaseEnv => {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  const missing: string[] = [];

  if (!supabaseUrl) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  }

  if (!supabaseAnonKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY");
  }

  if (missing.length > 0) {
    console.error("Missing Supabase environment variables", { missing });
    throw new MissingSupabaseEnvError(missing);
  }

  return { supabaseUrl, supabaseAnonKey };
};

export const createSupabaseRouteClient = () => {
  const { supabaseUrl, supabaseAnonKey } = resolveSupabaseEnv();
  return createRouteHandlerClient(
    { cookies },
    { supabaseUrl, supabaseKey: supabaseAnonKey },
  );
};
