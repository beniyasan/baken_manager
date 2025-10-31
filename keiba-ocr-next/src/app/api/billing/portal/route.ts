import { NextResponse } from "next/server";

import { getStripeClient } from "@/lib/stripe";
import { createSupabaseRouteClient } from "@/lib/supabaseRouteClient";
import { debugLog } from "@/lib/debug";
import { findExistingCustomerId } from "@/lib/stripeCustomers";
import { isUndefinedColumnError } from "@/lib/supabaseErrors";
import type { Database } from "@/types/database";

const LOGIN_REQUIRED_MESSAGE = "プレミアム機能を利用するにはログインが必要です。";

export async function POST() {
  try {
    const appBaseUrl = process.env.APP_BASE_URL;

    if (!appBaseUrl) {
      console.error("APP_BASE_URL が設定されていません");
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

    type ProfileStripeInfo = Pick<
      Database["public"]["Tables"]["profiles"]["Row"],
      "stripe_customer_id"
    >;

    let stripeCustomerColumnAvailable = true;
    let profile: ProfileStripeInfo | null = null;

    {
      const { data, error } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle<ProfileStripeInfo>();

      if (error) {
        if (isUndefinedColumnError(error, "stripe_customer_id")) {
          stripeCustomerColumnAvailable = false;
          debugLog("portal stripe_customer_id missing; falling back", { userId: user.id });
        } else {
          console.error("プロフィール情報の取得に失敗", error);
          return NextResponse.json({ error: "プロフィール情報の取得に失敗しました" }, { status: 500 });
        }
      } else {
        profile = data;
      }
    }

    const stripe = getStripeClient();
    let customerId = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      const existingId = await findExistingCustomerId(stripe, {
        userId: user.id,
        email: user.email,
      });

      if (existingId) {
        customerId = existingId;
      }
    }

    if (!customerId) {
      const message = stripeCustomerColumnAvailable
        ? "Stripe顧客情報が見つかりません"
        : "Stripe顧客情報が未連携の可能性があります";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appBaseUrl}/account`,
    });

    if (!session.url) {
      console.error("カスタマーポータルURLの取得に失敗", session.id);
      return NextResponse.json({ error: "カスタマーポータルの作成に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("カスタマーポータルの作成中にエラーが発生", error);
    return NextResponse.json({ error: "カスタマーポータルの作成に失敗しました" }, { status: 500 });
  }
}
