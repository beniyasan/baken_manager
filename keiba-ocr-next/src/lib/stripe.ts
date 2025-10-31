import Stripe from "stripe";
import { debugLog, safePrefix } from "./debug";

let cached: Stripe | null = null;

export function getStripeClient() {
  if (cached) return cached;
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) throw new Error("Missing env: STRIPE_SECRET_KEY");

  debugLog("stripe init", { STRIPE_SECRET_KEY_prefix: safePrefix(sk) });

  cached = new Stripe(sk, { apiVersion: "2023-10-16" });
  return cached;
}
