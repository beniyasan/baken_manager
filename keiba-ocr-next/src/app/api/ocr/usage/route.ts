import { NextResponse } from "next/server";
import { FEATURE_MESSAGES, resolvePlan } from "@/lib/plans";
import { buildUsageSnapshot, getUsageMonthKey } from "@/lib/ocrUsage";
import { createSupabaseRouteClient } from "@/lib/supabaseRouteClient";
import type { Database } from "@/types/database";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const LOGIN_REQUIRED_MESSAGE = "OCRを利用するにはログインが必要です。";

export async function GET() {
  try {
    const supabase = createSupabaseRouteClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Supabase 認証情報の取得に失敗", authError);
      return NextResponse.json({ error: LOGIN_REQUIRED_MESSAGE }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: LOGIN_REQUIRED_MESSAGE }, { status: 401 });
    }

    type ProfileRoleInfo = Pick<
      Database["public"]["Tables"]["profiles"]["Row"],
      "user_role"
    >;

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("user_role")
      .eq("id", user.id)
      .maybeSingle<ProfileRoleInfo>();

    if (profileError) {
      console.error("ユーザープロフィールの取得に失敗", profileError);
      return NextResponse.json({ error: "OCR利用状況の取得に失敗しました" }, { status: 500 });
    }

    const plan = resolvePlan(profileRow?.user_role ?? null);

    if (!plan.ocrEnabled) {
      return NextResponse.json({ error: FEATURE_MESSAGES.ocrDisabled }, { status: 403 });
    }

    if (plan.ocrMonthlyLimit === null) {
      return NextResponse.json(buildUsageSnapshot({ limit: null, used: 0 }));
    }

    const usageMonth = getUsageMonthKey();
    type UsageMonthlyInfo = Pick<
      Database["public"]["Tables"]["ocr_usage_monthly"]["Row"],
      "usage_count"
    >;

    const { data: usageRow, error: usageError } = await supabase
      .from("ocr_usage_monthly")
      .select("usage_count")
      .eq("user_id", user.id)
      .eq("usage_month", usageMonth)
      .maybeSingle<UsageMonthlyInfo>();

    if (usageError) {
      console.error("OCR利用状況の取得に失敗", usageError);
      return NextResponse.json({ error: "OCR利用状況の取得に失敗しました" }, { status: 500 });
    }

    const usageSnapshot = buildUsageSnapshot({
      limit: plan.ocrMonthlyLimit,
      used: usageRow?.usage_count ?? 0,
    });

    return NextResponse.json(usageSnapshot);
  } catch (error) {
    console.error("OCR利用状況取得APIエラー", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    const supabase = createSupabaseRouteClient();

    const { data: who, error: whoError } = await supabase.rpc("get_auth_uid_or_null");
    if (whoError) {
      console.error("auth.uid() diagnostic failed", whoError);
    }
    console.log("auth.uid() on server:", who ?? null);

    const { data, error } = await supabase.rpc("consume_ocr_credit");

    if (error) {
      console.error("consume_ocr_credit failed", error);
      return NextResponse.json({ error: "OCR利用回数の更新に失敗しました" }, { status: 500 });
    }

    if (data === false) {
      return NextResponse.json({ error: "FREEプランの月次上限に達しました" }, { status: 402 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("OCR利用回数更新APIエラー", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
