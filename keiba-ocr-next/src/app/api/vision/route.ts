import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { FEATURE_MESSAGES, resolvePlan } from "@/lib/plans";
import { buildUsageSnapshot, getUsageMonthKey, type OcrUsageSnapshot } from "@/lib/ocrUsage";

const VISION_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";
const LOGIN_REQUIRED_MESSAGE = "OCRを利用するにはログインが必要です。";

export async function POST(request: NextRequest) {
  try {
    const { imageData } = await request.json();

    if (!imageData || typeof imageData !== "string") {
      return NextResponse.json({ error: "画像データが無効です" }, { status: 400 });
    }

    const apiKey = process.env.GCV_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GCV_API_KEY が設定されていません" }, { status: 500 });
    }

    const supabase = createRouteHandlerClient({ cookies });
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

    const usageMonth = getUsageMonthKey();
    let usageSnapshot: OcrUsageSnapshot | null = null;
    let currentUsageCount = 0;

    if (plan.ocrMonthlyLimit !== null) {
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

      currentUsageCount = usageRow?.usage_count ?? 0;

      if (currentUsageCount >= plan.ocrMonthlyLimit) {
        usageSnapshot = buildUsageSnapshot({ limit: plan.ocrMonthlyLimit, used: currentUsageCount });
        return NextResponse.json(
          {
            error: FEATURE_MESSAGES.ocrLimitReached,
            usage: usageSnapshot,
          },
          { status: 429 },
        );
      }
    }

    const base64Content = imageData.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

    const response = await fetch(`${VISION_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Content,
            },
            features: [
              {
                type: "DOCUMENT_TEXT_DETECTION",
              },
            ],
            imageContext: {
              languageHints: ["ja"],
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Vision API Error", response.status, errorText);
      const body = {
        error: "Vision API が失敗しました",
      } as { error: string; usage?: unknown };

      if (plan.ocrMonthlyLimit !== null) {
        body.usage = buildUsageSnapshot({ limit: plan.ocrMonthlyLimit, used: currentUsageCount });
      }

      return NextResponse.json(body, { status: response.status });
    }

    const result = await response.json();
    const visionResponse = result?.responses?.[0];

    if (!visionResponse) {
      return NextResponse.json({ error: "Vision API 応答が不正です" }, { status: 500 });
    }

    if (visionResponse.error) {
      return NextResponse.json({ error: visionResponse.error.message || "Vision API エラー" }, { status: 500 });
    }

    const text =
      visionResponse.fullTextAnnotation?.text ??
      (Array.isArray(visionResponse.textAnnotations) ? visionResponse.textAnnotations[0]?.description : "") ??
      "";

    let nextUsageSnapshot: OcrUsageSnapshot | null = usageSnapshot;

    if (plan.ocrMonthlyLimit !== null) {
      const { data: consumeData, error: consumeError } = await supabase.rpc("consume_ocr_credit", {
        target_month: usageMonth,
        usage_limit: plan.ocrMonthlyLimit,
      });

      if (consumeError) {
        console.error("OCR利用回数の更新に失敗", consumeError);
        return NextResponse.json({ error: "OCR利用回数の更新に失敗しました" }, { status: 500 });
      }

      const consumeResult = Array.isArray(consumeData) ? consumeData[0] : consumeData;

      if (!consumeResult?.success) {
        nextUsageSnapshot = buildUsageSnapshot({
          limit: plan.ocrMonthlyLimit,
          used: consumeResult?.usage_count ?? plan.ocrMonthlyLimit,
        });

        return NextResponse.json(
          {
            error: FEATURE_MESSAGES.ocrLimitReached,
            usage: nextUsageSnapshot,
          },
          { status: 429 },
        );
      }

      nextUsageSnapshot = buildUsageSnapshot({
        limit: plan.ocrMonthlyLimit,
        used: consumeResult?.usage_count ?? currentUsageCount + 1,
      });
    }

    return NextResponse.json({ text, usage: nextUsageSnapshot });
  } catch (error) {
    console.error("Vision API 呼び出しエラー", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
