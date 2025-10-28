import type { User } from "@supabase/supabase-js";

export type UserRole = "free" | "premium" | "admin";

export type PlanFeatures = {
  role: UserRole;
  label: string;
  maxBets: number | null;
  ocrEnabled: boolean;
  aiAssistEnabled: boolean;
  upgradeUrl?: string;
};

export type ProfileRow = {
  id: string;
  display_name: string | null;
  user_role: UserRole | null;
};

export type CurrentProfile = {
  id: string;
  displayName: string;
  userRole: UserRole;
};

export const PLAN_FEATURES: Record<UserRole, PlanFeatures> = {
  free: {
    role: "free",
    label: "フリープラン",
    maxBets: 200,
    ocrEnabled: false,
    aiAssistEnabled: false,
    upgradeUrl: "/#pricing",
  },
  premium: {
    role: "premium",
    label: "プレミアムプラン",
    maxBets: null,
    ocrEnabled: true,
    aiAssistEnabled: true,
  },
  admin: {
    role: "admin",
    label: "管理者",
    maxBets: null,
    ocrEnabled: true,
    aiAssistEnabled: true,
  },
};

export const FEATURE_MESSAGES = {
  ocrDisabled: "画像のOCR解析はプレミアムプラン限定の機能です。",
  aiAssistDisabled: "AIによる買い目補助はプレミアムプラン限定の機能です。",
  maxBets: (limit: number) => `保存できる馬券データはフリープランでは${limit}件までです。`,
};

export const resolvePlan = (role: string | null | undefined): PlanFeatures => {
  if (!role) {
    return PLAN_FEATURES.free;
  }

  if (role in PLAN_FEATURES) {
    return PLAN_FEATURES[role as UserRole];
  }

  return PLAN_FEATURES.free;
};

export const normalizeProfile = (
  user: User | null,
  row: ProfileRow | null | undefined,
): CurrentProfile | null => {
  if (!user) return null;

  const rawRole = row?.user_role ?? null;
  const plan = resolvePlan(rawRole);
  const displayName = String(row?.display_name ?? user.user_metadata?.display_name ?? user.email ?? "").trim();

  return {
    id: row?.id ?? user.id,
    displayName,
    userRole: plan.role,
  };
};

export const getAccountLabel = (profile: CurrentProfile | null, user: User | null): string => {
  if (profile?.displayName) return profile.displayName;
  if (!user) return "未ログイン";
  const nickname = String(user.user_metadata?.display_name ?? "").trim();
  return nickname || user.email || "未ログイン";
};

