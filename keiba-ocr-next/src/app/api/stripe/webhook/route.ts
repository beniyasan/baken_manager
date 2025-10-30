import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabaseAdminClient";
import type { Database } from "@/types/database";

export const runtime = "nodejs";

const LOG_PREFIX = "[StripeWebhook]";
const PREMIUM_STATUSES = new Set(["active", "trialing"]);
const PROFILE_COLUMNS =
  "id,user_role,stripe_customer_id,stripe_subscription_id,stripe_price_id,subscription_status,current_period_end,cancel_at_period_end";

type AdminClient = SupabaseClient<Database>;
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type UserRole = Database["public"]["Enums"]["user_role"];

const extractCustomerId = (
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null => {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  if ("deleted" in customer && customer.deleted) return null;
  return customer.id;
};

const extractSubscriptionId = (
  subscription: string | Stripe.Subscription | null | undefined,
): string | null => {
  if (!subscription) return null;
  if (typeof subscription === "string") return subscription;
  return subscription.id;
};

const toIsoString = (timestamp: number | null | undefined): string | null => {
  if (!timestamp) return null;
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

const determineNextRole = (
  currentRole: UserRole | null,
  status: string | null,
  periodEndIso: string | null,
): UserRole | null => {
  if (currentRole === "admin") {
    return null;
  }

  if (!status) {
    return null;
  }

  if (PREMIUM_STATUSES.has(status)) {
    if (!periodEndIso) {
      return "premium";
    }

    const periodEnd = new Date(periodEndIso);
    if (!Number.isNaN(periodEnd.getTime()) && periodEnd.getTime() > Date.now()) {
      return "premium";
    }
  }

  return "free";
};

const fetchProfileById = async (supabase: AdminClient, userId: string): Promise<ProfileRow | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`プロフィールの取得に失敗しました (user_id=${userId}): ${error.message}`);
  }

  return data;
};

const fetchProfileByCustomerId = async (
  supabase: AdminClient,
  customerId: string,
): Promise<ProfileRow | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw new Error(`プロフィールの取得に失敗しました (customer_id=${customerId}): ${error.message}`);
  }

  return data;
};

const resolveProfileForCustomer = async (
  supabase: AdminClient,
  stripe: Stripe,
  customerId: string,
): Promise<ProfileRow | null> => {
  const profile = await fetchProfileByCustomerId(supabase, customerId);

  if (profile) {
    return profile;
  }

  const customer = await stripe.customers.retrieve(customerId);

  if (!customer || ("deleted" in customer && customer.deleted)) {
    return null;
  }

  const userIdFromMetadata = typeof customer.metadata?.user_id === "string" ? customer.metadata.user_id : null;

  if (!userIdFromMetadata) {
    return null;
  }

  return fetchProfileById(supabase, userIdFromMetadata);
};

const fetchSubscription = async (stripe: Stripe, subscriptionId: string): Promise<Stripe.Subscription> =>
  stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price"] });

const applySubscriptionUpdate = async (
  supabase: AdminClient,
  profile: ProfileRow,
  params: {
    userId: string;
    customerId?: string | null;
    subscription?: Stripe.Subscription | null;
    subscriptionId?: string | null;
    priceIdOverride?: string | null | undefined;
    overrideStatus?: string | null;
  },
): Promise<void> => {
  const updates: ProfileUpdate = {};

  if (params.customerId) {
    updates.stripe_customer_id = params.customerId;
  } else if (!profile.stripe_customer_id) {
    updates.stripe_customer_id = null;
  }

  const subscriptionId = params.subscriptionId ?? params.subscription?.id ?? null;
  if (subscriptionId !== null) {
    updates.stripe_subscription_id = subscriptionId;
  }

  const priceId =
    params.priceIdOverride === undefined
      ? params.subscription?.items?.data?.[0]?.price?.id ?? null
      : params.priceIdOverride;

  if (priceId !== undefined) {
    updates.stripe_price_id = priceId;
  }

  const status = params.overrideStatus ?? params.subscription?.status ?? null;
  const periodEndIso = toIsoString(params.subscription?.current_period_end);

  if (status !== null) {
    updates.subscription_status = status;
  }

  if (params.subscription) {
    updates.current_period_end = periodEndIso;
    updates.cancel_at_period_end = params.subscription.cancel_at_period_end ?? false;
  } else if (status !== null) {
    updates.cancel_at_period_end = false;
    updates.current_period_end = periodEndIso;
  }

  const nextRole = determineNextRole(profile.user_role, status, periodEndIso);

  if (nextRole && profile.user_role !== "admin") {
    updates.user_role = nextRole;
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", params.userId);

  if (updateError) {
    throw new Error(`プロフィールの更新に失敗しました (user_id=${params.userId}): ${updateError.message}`);
  }
};

const handleCheckoutSessionCompleted = async (
  stripe: Stripe,
  supabase: AdminClient,
  session: Stripe.Checkout.Session,
): Promise<string> => {
  const userId = session.client_reference_id;

  if (!userId) {
    throw new Error("client_reference_id が存在しない Checkout セッションを受信しました");
  }

  const customerId = extractCustomerId(session.customer);

  if (!customerId) {
    throw new Error(`Checkout セッションに顧客情報が含まれていません (session_id=${session.id})`);
  }

  const subscriptionId = extractSubscriptionId(session.subscription);

  const subscription = subscriptionId ? await fetchSubscription(stripe, subscriptionId) : null;

  const profile = await fetchProfileById(supabase, userId);

  if (!profile) {
    throw new Error(`プロフィールが見つかりません (user_id=${userId})`);
  }

  await applySubscriptionUpdate(supabase, profile, {
    userId,
    customerId,
    subscription,
    subscriptionId,
  });

  console.info(
    `${LOG_PREFIX} checkout.session.completed processed`,
    `event_user=${userId}`,
    `customer=${customerId}`,
    `subscription=${subscriptionId ?? "unknown"}`,
  );

  return `checkout.session.completed: user=${userId}, subscription=${subscriptionId ?? "unknown"}`;
};

const handleSubscriptionUpdated = async (
  stripe: Stripe,
  supabase: AdminClient,
  subscription: Stripe.Subscription,
): Promise<string> => {
  const customerId = extractCustomerId(subscription.customer);

  if (!customerId) {
    throw new Error(`subscription.updated に顧客情報が含まれていません (subscription_id=${subscription.id})`);
  }

  const profile = await resolveProfileForCustomer(supabase, stripe, customerId);

  if (!profile) {
    throw new Error(`顧客に紐づくプロフィールが見つかりません (customer_id=${customerId})`);
  }

  await applySubscriptionUpdate(supabase, profile, {
    userId: profile.id,
    customerId,
    subscription,
    subscriptionId: subscription.id,
  });

  console.info(
    `${LOG_PREFIX} customer.subscription.updated processed`,
    `user=${profile.id}`,
    `customer=${customerId}`,
    `subscription=${subscription.id}`,
    `status=${subscription.status}`,
  );

  return `customer.subscription.updated: subscription=${subscription.id}, status=${subscription.status}`;
};

const handleInvoicePaid = async (
  stripe: Stripe,
  supabase: AdminClient,
  invoice: Stripe.Invoice,
): Promise<string> => {
  const customerId = extractCustomerId(invoice.customer);

  if (!customerId) {
    throw new Error(`invoice.paid に顧客情報が含まれていません (invoice_id=${invoice.id})`);
  }

  const profile = await resolveProfileForCustomer(supabase, stripe, customerId);

  if (!profile) {
    throw new Error(`顧客に紐づくプロフィールが見つかりません (customer_id=${customerId})`);
  }

  const subscriptionId = extractSubscriptionId(invoice.subscription);

  if (!subscriptionId) {
    throw new Error(`invoice.paid にサブスクリプション情報が含まれていません (invoice_id=${invoice.id})`);
  }

  const subscription = await fetchSubscription(stripe, subscriptionId);
  const priceId = invoice.lines?.data?.[0]?.price?.id ?? subscription.items?.data?.[0]?.price?.id ?? null;

  await applySubscriptionUpdate(supabase, profile, {
    userId: profile.id,
    customerId,
    subscription,
    subscriptionId,
    priceIdOverride: priceId,
  });

  console.info(
    `${LOG_PREFIX} invoice.paid processed`,
    `user=${profile.id}`,
    `customer=${customerId}`,
    `subscription=${subscriptionId}`,
    `invoice=${invoice.id}`,
  );

  return `invoice.paid: subscription=${subscriptionId}, invoice=${invoice.id}`;
};

const handleInvoicePaymentFailed = async (
  stripe: Stripe,
  supabase: AdminClient,
  invoice: Stripe.Invoice,
): Promise<string> => {
  const customerId = extractCustomerId(invoice.customer);

  if (!customerId) {
    throw new Error(`invoice.payment_failed に顧客情報が含まれていません (invoice_id=${invoice.id})`);
  }

  const profile = await resolveProfileForCustomer(supabase, stripe, customerId);

  if (!profile) {
    throw new Error(`顧客に紐づくプロフィールが見つかりません (customer_id=${customerId})`);
  }

  const subscriptionId = extractSubscriptionId(invoice.subscription);

  if (!subscriptionId) {
    throw new Error(`invoice.payment_failed にサブスクリプション情報が含まれていません (invoice_id=${invoice.id})`);
  }

  const subscription = await fetchSubscription(stripe, subscriptionId);
  const priceId = invoice.lines?.data?.[0]?.price?.id ?? subscription.items?.data?.[0]?.price?.id ?? null;

  await applySubscriptionUpdate(supabase, profile, {
    userId: profile.id,
    customerId,
    subscription,
    subscriptionId,
    priceIdOverride: priceId,
  });

  console.info(
    `${LOG_PREFIX} invoice.payment_failed processed`,
    `user=${profile.id}`,
    `customer=${customerId}`,
    `subscription=${subscriptionId}`,
    `invoice=${invoice.id}`,
  );

  return `invoice.payment_failed: subscription=${subscriptionId}, invoice=${invoice.id}`;
};

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error(`${LOG_PREFIX} STRIPE_WEBHOOK_SECRET が設定されていません`);
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.error(`${LOG_PREFIX} stripe-signature ヘッダーが存在しません`);
    return new NextResponse("Missing stripe-signature header", { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error(`${LOG_PREFIX} Webhook 署名検証に失敗`, error);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const eventId = event.id;
  const receivedAt = new Date().toISOString();

  const { data: existingLog, error: logFetchError } = await supabase
    .from("stripe_event_log")
    .select("event_id, processed_at, ok")
    .eq("event_id", eventId)
    .maybeSingle();

  if (logFetchError) {
    console.error(`${LOG_PREFIX} イベントログの取得に失敗`, logFetchError);
    return new NextResponse("Failed to access event log", { status: 500 });
  }

  if (existingLog?.processed_at && existingLog.ok) {
    console.info(`${LOG_PREFIX} 既に処理済みのイベントをスキップ`, event.type, eventId);
    return NextResponse.json({ received: true });
  }

  if (!existingLog) {
    const { error: insertError } = await supabase.from("stripe_event_log").insert({
      event_id: eventId,
      type: event.type,
      received_at: receivedAt,
    });

    if (insertError) {
      console.error(`${LOG_PREFIX} イベントログの作成に失敗`, insertError);
      return new NextResponse("Failed to prepare event log", { status: 500 });
    }
  } else {
    const { error: updateError } = await supabase
      .from("stripe_event_log")
      .update({
        type: event.type,
        received_at: receivedAt,
        processed_at: null,
        ok: null,
        note: null,
      })
      .eq("event_id", eventId);

    if (updateError) {
      console.error(`${LOG_PREFIX} イベントログの更新に失敗`, updateError);
      return new NextResponse("Failed to update event log", { status: 500 });
    }
  }

  let note: string | null = null;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        note = await handleCheckoutSessionCompleted(
          stripe,
          supabase,
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      }
      case "customer.subscription.updated": {
        note = await handleSubscriptionUpdated(
          stripe,
          supabase,
          event.data.object as Stripe.Subscription,
        );
        break;
      }
      case "invoice.paid": {
        note = await handleInvoicePaid(stripe, supabase, event.data.object as Stripe.Invoice);
        break;
      }
      case "invoice.payment_failed": {
        note = await handleInvoicePaymentFailed(
          stripe,
          supabase,
          event.data.object as Stripe.Invoice,
        );
        break;
      }
      default: {
        console.info(`${LOG_PREFIX} 未対応イベントを受信`, event.type);
        note = `ignored: ${event.type}`;
      }
    }

    const { error: completeError } = await supabase
      .from("stripe_event_log")
      .update({
        processed_at: new Date().toISOString(),
        ok: true,
        note,
      })
      .eq("event_id", eventId);

    if (completeError) {
      console.error(`${LOG_PREFIX} イベントログの完了更新に失敗`, completeError);
      return new NextResponse("Failed to finalize event log", { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`${LOG_PREFIX} イベント処理中にエラーが発生`, event.type, eventId, error);

    const { error: failedUpdateError } = await supabase
      .from("stripe_event_log")
      .update({
        processed_at: new Date().toISOString(),
        ok: false,
        note: error instanceof Error ? error.message : String(error),
      })
      .eq("event_id", eventId);

    if (failedUpdateError) {
      console.error(`${LOG_PREFIX} エラーログの更新に失敗`, failedUpdateError);
    }

    return new NextResponse("Webhook handler error", { status: 500 });
  }
}
