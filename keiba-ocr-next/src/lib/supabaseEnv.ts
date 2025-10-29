const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export class MissingSupabaseEnvError extends Error {
  constructor(missingKeys: string[]) {
    const messageBase =
      "Supabase の接続情報が見つかりません。NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY を設定してください。";
    super(
      missingKeys.length
        ? `${messageBase} (不足: ${missingKeys.join(", ")})`
        : messageBase,
    );
    this.name = "MissingSupabaseEnvError";
  }
}

export const isMissingSupabaseEnvError = (
  error: unknown,
): error is MissingSupabaseEnvError => {
  if (error instanceof MissingSupabaseEnvError) {
    return true;
  }

  if (isObject(error) && "name" in error) {
    return error.name === "MissingSupabaseEnvError";
  }

  return false;
};

type SupabaseEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export const resolveSupabaseEnv = (): SupabaseEnv => {
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
