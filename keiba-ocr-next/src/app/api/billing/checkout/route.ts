import { NextRequest, NextResponse } from "next/server";

import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabaseAdminClient";
import { createSupabaseRouteClient } from "@/lib/supabaseRouteClient";

const LOGIN_REQUIRED_MESSAGE = "プレミアム機能を利用するにはログインが必要です。";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const priceId = process.env.STRIPE_PRICE_ID_PREMIUM;
    const appBaseUrl =
      process.env.APP_BASE_URL ?? new URL(request.url).origin;

    if (!priceId) {
      console.error("Stripe の価格IDが設定されていません");
      return NextResponse.json({ error: "課金設定が正しく構成されていません" }, { status: 500 });
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("プロフィール情報の取得に失敗", profileError);
      return NextResponse.json({ error: "プロフィール情報の取得に失敗しました" }, { status: 500 });
    }

    const stripe = getStripeClient();

    let customerId = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      const adminSupabase = getSupabaseAdminClient();
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          user_id: user.id,
        },
      });

      customerId = customer.id;

      const { error: updateError } = await adminSupabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);

      if (updateError) {
        console.error("Stripe顧客IDの保存に失敗", updateError);
        return NextResponse.json({ error: "顧客情報の更新に失敗しました" }, { status: 500 });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: user.id,
      success_url: `${appBaseUrl}/billing/success`,
      cancel_url: `${appBaseUrl}/billing/cancel`,
      subscription_data: {
        metadata: {
          user_id: user.id,
        },
      },
    });

    if (!session.url) {
      console.error("Checkout セッションURLの取得に失敗", session.id);
      return NextResponse.json({ error: "Checkout セッションの作成に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout セッションの作成中にエラーが発生", error);
    return NextResponse.json({ error: "Checkout セッションの作成に失敗しました" }, { status: 500 });
  }
}
