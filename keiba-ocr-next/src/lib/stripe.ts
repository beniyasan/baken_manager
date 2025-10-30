import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export const getStripeClient = (): Stripe => {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY が設定されていません");
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: "2023-10-16",
  });

  return stripeClient;
};
