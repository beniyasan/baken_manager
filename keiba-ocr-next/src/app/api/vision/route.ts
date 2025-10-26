import { NextRequest, NextResponse } from "next/server";

const VISION_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";

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
      return NextResponse.json({ error: "Vision API が失敗しました" }, { status: response.status });
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

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Vision API 呼び出しエラー", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
