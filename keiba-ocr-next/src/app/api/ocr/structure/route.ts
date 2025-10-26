import { NextRequest, NextResponse } from "next/server";

const PERPLEXITY_ENDPOINT = "https://api.perplexity.ai/chat/completions";

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "テキストが無効です" }, { status: 400 });
    }

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "PERPLEXITY_API_KEY が設定されていません" }, { status: 500 });
    }

    const prompt = `以下の馬券明細テキストから、券種ごとの買い目一覧、レース情報、払戻金などを抽出してください。\n` +
      `可能な限り正確に数値は整数で推定し、不明な場合は 0 を設定してください。\n` +
      `JSON でのみ回答し、以下の形式を厳守してください:\n` +
      `{"date":"YYYY-MM-DD or null","source":"即pat|Spat4|その他","track":"競馬場名 or null","raceName":"レース名 or null","payout":number,"bets":[{"type":"券種","numbers":["1","2"],"amount":number}],"memo":null}`;

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
    const content = result?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Perplexity 応答が不正です" }, { status: 500 });
    }

    let structured;
    try {
      structured = JSON.parse(content);
    } catch (parseError) {
      console.error("Perplexity 応答のJSON解析に失敗", parseError, content);
      return NextResponse.json({ error: "Perplexity 応答の JSON 解析に失敗しました" }, { status: 500 });
    }

    return NextResponse.json(structured);
  } catch (error) {
    console.error("Perplexity 呼び出しエラー", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
