import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabaseAdminClient";
import { createSupabaseRouteClient } from "@/lib/supabaseRouteClient";
import { debugLog, isDebugBilling, safePrefix } from "@/lib/debug";
import type { Database } from "@/types/database";

const LOGIN_REQUIRED_MESSAGE = "プレミアム機能を利用するにはログインが必要です。";
export const runtime = "nodejs";

type ProfileStripeInfo = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "stripe_customer_id"
>;

export async function GET(request: NextRequest) {
  try {
    const payload: any = {
      ok: true,
      now: new Date().toISOString(),
      debug: isDebugBilling(),
    };

    if (isDebugBilling()) {
      payload.env = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY_prefix: safePrefix(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY_prefix: safePrefix(process.env.SUPABASE_SERVICE_ROLE_KEY),
        STRIPE_PRICE_ID_PREMIUM: process.env.STRIPE_PRICE_ID_PREMIUM ?? "(undefined)",
        STRIPE_SECRET_KEY_prefix: safePrefix(process.env.STRIPE_SECRET_KEY),
        APP_BASE_URL: process.env.APP_BASE_URL ?? "(undefined)",
      };

      try {
        const admin = getSupabaseAdminClient();
        payload.adminClient = "ok";
        debugLog("health admin ok", { hasClient: Boolean(admin) });
      } catch (e: any) {
        payload.adminClient = `error: ${e?.message ?? e}`;
        debugLog("health admin error", e?.message ?? e);
      }

      try {
        const route = createSupabaseRouteClient();
        const { data, error } = await route.auth.getUser();
        payload.routeAuth = { userId: data?.user?.id ?? null, error: error?.message ?? null };
        debugLog("health route auth", payload.routeAuth);
      } catch (e: any) {
        payload.routeAuth = `error: ${e?.message ?? e}`;
        debugLog("health route error", e?.message ?? e);
      }
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const priceId = process.env.STRIPE_PRICE_ID_PREMIUM;
    const appBaseUrl = process.env.APP_BASE_URL ?? new URL(request.url).origin;

    debugLog("checkout POST", {
      hasPriceId: Boolean(priceId),
      appBaseUrl,
    });

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
      return NextResponse.json(
        { error: LOGIN_REQUIRED_MESSAGE, detail: authError.message },
        { status: 401 }
      );
    }
    if (!user) {
      return NextResponse.json({ error: LOGIN_REQUIRED_MESSAGE }, { status: 401 });
    }

    const adminSupabase = getSupabaseAdminClient();
    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle<ProfileStripeInfo>();

    if (profileError) {
      console.error("プロフィール情報の取得に失敗", profileError);
      return NextResponse.json(
        {
          error: "プロフィール情報の取得に失敗しました",
          detail: isDebugBilling() ? profileError.message : undefined,
        },
        { status: 500 }
      );
    }

    const stripe = getStripeClient();
    let customerId = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;

      const { error: updateError } = await adminSupabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);

      if (updateError) {
        console.error("Stripe顧客IDの保存に失敗", updateError);
        return NextResponse.json(
          {
            error: "顧客情報の更新に失敗しました",
            detail: isDebugBilling() ? updateError.message : undefined,
          },
          { status: 500 }
        );
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      success_url: `${appBaseUrl}/billing/success`,
      cancel_url: `${appBaseUrl}/billing/cancel`,
      subscription_data: { metadata: { user_id: user.id } },
    });

    if (!session.url) {
      console.error("Checkout セッションURLの取得に失敗", session.id);
      return NextResponse.json({ error: "Checkout セッションの作成に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Checkout セッションの作成中にエラーが発生", error);
    return NextResponse.json(
      {
        error: "Checkout セッションの作成に失敗しました",
        detail: isDebugBilling() ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}
