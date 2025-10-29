import { NextResponse } from "next/server";
import { FEATURE_MESSAGES, resolvePlan } from "@/lib/plans";
import { buildUsageSnapshot, getUsageMonthKey } from "@/lib/ocrUsage";
import { createSupabaseRouteClient, isMissingSupabaseEnvError } from "@/lib/supabaseRouteClient";

export const runtime = "nodejs";

const LOGIN_REQUIRED_MESSAGE = "OCRを利用するにはログインが必要です。";

export async function GET() {
  try {
    const supabase = await createSupabaseRouteClient();
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

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("user_role")
      .eq("id", user.id)
      .maybeSingle();

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
    const { data: usageRow, error: usageError } = await supabase
      .from("ocr_usage_monthly")
      .select("usage_count")
      .eq("user_id", user.id)
      .eq("usage_month", usageMonth)
      .maybeSingle();

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
    if (isMissingSupabaseEnvError(error)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
