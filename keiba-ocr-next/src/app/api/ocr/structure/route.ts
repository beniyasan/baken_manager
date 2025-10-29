import { NextRequest, NextResponse } from "next/server";
import { FEATURE_MESSAGES, resolvePlan } from "@/lib/plans";
import {
  MissingSupabaseEnvError,
  createSupabaseRouteClient,
} from "@/lib/supabaseRouteClient";

const PERPLEXITY_ENDPOINT = "https://api.perplexity.ai/chat/completions";
const LOGIN_REQUIRED_MESSAGE = "OCRを利用するにはログインが必要です。";

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "テキストが無効です" }, { status: 400 });
    }

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
      return NextResponse.json({ error: "OCR利用状況の取得に失敗しました" }, { status: 500 });
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
      "以下の馬券明細テキストから、券種ごとの買い目一覧、レース情報、払戻金などを抽出してください。",
      "",
      "### 出力要件",
      "- 数値は可能な限り正確に整数で推定し、不明な場合は 0 を設定してください。",
      "- JSON でのみ回答し、以下の形式を厳守してください:",
      '  {"date":"YYYY-MM-DD or null","source":"即pat|Spat4|その他","track":"競馬場名 or null","raceName":"レース名 or null","payout":number,"bets":[{"type":"券種","numbers":["1","2"],"amount":number}],"memo":null}',
      "- bets 配列には、券種ごとに購入した 1 点 (=1 組み合わせ) を 1 要素として列挙してください。",
      "",
      "### フォーメーション・流しなど複数行構造の扱い",
      "- 「フォーメーション」「流し」「マルチ」などが記載されている場合は、縦横に並ぶ数字群を券面の指定順序 (1 着→2 着→3 着 …) で読み取り、直積で全組み合わせを生成してください。",
      "- 行や列の見出し (例: 1着, 2着, 3着 / 1列目, 2列目 など) があれば、その順序に従って numbers 配列を並べ替えてください。",
      "- 票面上で同じ数字が複数回現れる場合は重複として扱い、生成される組み合わせからは除いてください。",
      "- 金額が「各100円」「計1000円」など複数表記されている場合は、各組み合わせに紐づく実際の購入額を求めて amount に記録してください (合計金額を組数で割り均等配分されている記載であれば均等割りで扱う)。",
      "- 券種が 2 連系の場合は 2 要素、3 連系の場合は 3 要素になるよう numbers 配列を構成してください。",
      "",
      "### 不明値の扱い",
      "- テキストから判別できない値は null または 0 を設定し、推測で補完しないでください。",
    ].join("\n");

    const payload = {
      model: "sonar",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "You are a precise data extraction assistant that only returns valid JSON.",
        },
        {
          role: "user",
          content: `${prompt}\n\nテキスト:\n${text}`,
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
    const contentRaw = result?.choices?.[0]?.message?.content;
    if (!contentRaw) {
      return NextResponse.json({ error: "Perplexity 応答が不正です" }, { status: 500 });
    }

    let structured;
    try {
      const fencedMatch = contentRaw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const content = fencedMatch ? fencedMatch[1] : contentRaw;
      const trimmed = content.trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
      structured = JSON.parse(trimmed);
    } catch (parseError) {
      console.error("Perplexity 応答のJSON解析に失敗", parseError, contentRaw);
      return NextResponse.json({ error: "Perplexity 応答の JSON 解析に失敗しました" }, { status: 500 });
    }

    return NextResponse.json(structured);
  } catch (error) {
    console.error("Perplexity 呼び出しエラー", error);
    if (error instanceof MissingSupabaseEnvError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
