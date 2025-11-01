import { NextRequest, NextResponse } from "next/server";
import { FEATURE_MESSAGES, resolvePlan } from "@/lib/plans";
import { createSupabaseRouteClient } from "@/lib/supabaseRouteClient";
import type { Database } from "@/types/database";

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

    const hasDateInput =
      typeof date !== "undefined" &&
      date !== null &&
      !(typeof date === "string" && date.trim().length === 0);

    if (hasDateInput && !isValidDate(date)) {
      return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
    }

    if (!isValidTrack(track) || !isValidRaceNumber(raceNumber)) {
      return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
    }

    const resolvedDate = (() => {
      if (hasDateInput && isValidDate(date)) {
        return date;
      }

      const now = new Date();
      const tokyoNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
      const year = tokyoNow.getFullYear();
      const month = String(tokyoNow.getMonth() + 1).padStart(2, "0");
      const day = String(tokyoNow.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    })();

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

    const japaneseDate = (() => {
      const [year, month, day] = resolvedDate.split("-");
      return `${year}年${Number.parseInt(month, 10)}月${Number.parseInt(day, 10)}日`;
    })();

    const trackForPrompt = /(?:競馬場|場)$/.test(track) ? track : `${track}競馬場`;

    const prompt = [
      "以下の開催情報に基づいて、日本の公式競馬レース名（重賞・特別を含む）を特定してください。",
      `- 開催日: ${japaneseDate} (ISO: ${resolvedDate})`,
      `- 開催場: ${trackForPrompt}`,
      `- 競走番号: 第${parsedRaceNumber}競走 (${parsedRaceNumber}R)`,
      "過去の開催結果や番組表など、公的に公開されている情報を参照して正確なレース名を回答してください。",
      "出力要件:",
      "1. JSON のみで回答し、形式は {\"raceName\": string | null} とします。",
      "2. レース名が特定できた場合は末尾に全角括弧で (${parsedRaceNumber}R) を付与してください。",
      "3. 公的な情報が存在しない場合や特定できない場合のみ raceName を null としてください。",
      "4. 事実と異なる名称を推測で生成しないでください。",
      "参考出力例: {\"raceName\": \"東京記念(11R)\"}",
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

    const raceName = parsed?.raceName ?? null;
    const normalizedRaceName = (() => {
      if (!raceName) return null;
      const suffix = `(${parsedRaceNumber}R)`;
      return raceName.endsWith(suffix) ? raceName : `${raceName}${suffix}`;
    })();

    return NextResponse.json({ raceName: normalizedRaceName });
  } catch (error) {
    console.error("レース名取得 API エラー", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
