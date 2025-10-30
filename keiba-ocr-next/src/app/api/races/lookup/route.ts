import { NextRequest, NextResponse } from "next/server";
import { FEATURE_MESSAGES, resolvePlan } from "@/lib/plans";
import { createSupabaseRouteClient } from "@/lib/supabaseRouteClient";

export const runtime = "nodejs";

const PERPLEXITY_ENDPOINT = "https://api.perplexity.ai/chat/completions";
const LOGIN_REQUIRED_MESSAGE = "レース名の取得にはログインが必要です。";

type LookupRequestBody = {
  date?: unknown;
  track?: unknown;
  raceNumber?: unknown;
};

type LookupResponse = {
  raceName: string | null;
};

const isValidDate = (value: unknown): value is string => {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
};

const isValidTrack = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const isValidRaceNumber = (value: unknown): value is number | string => {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1 && value <= 12;
  }
  if (typeof value === "string" && /^\d{1,2}$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    return parsed >= 1 && parsed <= 12;
  }
  return false;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LookupRequestBody;
    const { date, track, raceNumber } = body;

    if (!isValidDate(date) || !isValidTrack(track) || !isValidRaceNumber(raceNumber)) {
      return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
    }

    const parsedRaceNumber = typeof raceNumber === "number" ? raceNumber : Number.parseInt(raceNumber, 10);

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

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("user_role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("ユーザープロフィールの取得に失敗", profileError);
      return NextResponse.json({ error: "利用状況の取得に失敗しました" }, { status: 500 });
    }

    const plan = resolvePlan(profileRow?.user_role ?? null);

    if (!plan.ocrEnabled) {
      return NextResponse.json({ error: FEATURE_MESSAGES.ocrDisabled }, { status: 403 });
    }

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "PERPLEXITY_API_KEY が設定されていません" }, { status: 500 });
    }

    const prompt = [
      "以下の条件に該当する日本の競馬レース名を特定してください。",
      `- 日付: ${date}`,
      `- 競馬場: ${track}`,
      `- レース番号: ${parsedRaceNumber}R`,
      "同日に同じ競馬場で開催されたレースの正式名称を、過去の公表情報を参考にして回答してください。",
      "出力要件:",
      "- JSON でのみ回答し、次の形式に従ってください: {\"raceName\": string | null}.",
      `- レース名が判明した場合は、末尾に (${parsedRaceNumber}R) を付与してください。`,
      "- 判明しない場合や情報が存在しない場合は raceName を null にしてください。",
      "- 推測で存在しない名称を作成しないでください。",
    ].join("\n");

    const payload = {
      model: "sonar",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a meticulous research assistant who returns only valid JSON objects and includes verifiable information when possible.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    };

    const response = await fetch(PERPLEXITY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Perplexity API Error", response.status, errorText);
      return NextResponse.json({ error: "Perplexity API が失敗しました" }, { status: response.status });
    }

    const result = await response.json();
    const contentRaw: string | undefined = result?.choices?.[0]?.message?.content;
    if (!contentRaw) {
      return NextResponse.json({ error: "Perplexity 応答が不正です" }, { status: 500 });
    }

    let parsed: LookupResponse;
    try {
      const fencedMatch = contentRaw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const content = fencedMatch ? fencedMatch[1] : contentRaw;
      const trimmed = content
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
      parsed = JSON.parse(trimmed) as LookupResponse;
    } catch (parseError) {
      console.error("Perplexity 応答のJSON解析に失敗", parseError, contentRaw);
      return NextResponse.json({ error: "Perplexity 応答の JSON 解析に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ raceName: parsed?.raceName ?? null });
  } catch (error) {
    console.error("レース名取得 API エラー", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
