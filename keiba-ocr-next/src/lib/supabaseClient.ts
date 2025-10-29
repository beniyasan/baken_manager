import { createClient, type SupabaseClient as BaseSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const missingEnvMessage =
  "Supabase URL または anon key が設定されていません。環境変数を確認してください。";

const createMissingEnvProxy = (): BaseSupabaseClient => {
  const error = new Error(missingEnvMessage);
  return new Proxy({} as BaseSupabaseClient, {
    get() {
      throw error;
    },
    apply() {
      throw error;
    },
  });
};

export const supabaseClient: BaseSupabaseClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : createMissingEnvProxy();

export type SupabaseClient = typeof supabaseClient;
