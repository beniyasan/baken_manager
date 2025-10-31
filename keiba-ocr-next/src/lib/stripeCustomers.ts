import Stripe from "stripe";

import { debugLog, safePrefix } from "./debug";

function escapeForStripeMetadataQuery(value: string): string {
  return value.replace(/['\\]/g, "\\$&");
}

export async function findExistingCustomerId(
  stripe: Stripe,
  params: { userId: string; email?: string | null },
): Promise<string | null> {
  const sanitizedUserId = escapeForStripeMetadataQuery(params.userId);
  try {
    const searchResult = await stripe.customers.search({
      query: `metadata['user_id']:'${sanitizedUserId}'`,
      limit: 1,
    });

    const candidate = searchResult.data.find((customer) => !("deleted" in customer && customer.deleted));

    if (candidate) {
      debugLog("stripe customer reuse (metadata)", {
        userId: params.userId,
        customer_prefix: safePrefix(candidate.id, 6),
      });
      return candidate.id;
    }
  } catch (error) {
    console.warn("Stripe 顧客検索 (metadata) に失敗", error);
  }

  if (params.email) {
    try {
      const listResult = await stripe.customers.list({ email: params.email, limit: 5 });
      const candidate = listResult.data.find(
        (customer) =>
          !("deleted" in customer && customer.deleted) &&
          typeof customer.email === "string" &&
          customer.email.toLowerCase() === params.email!.toLowerCase(),
      );

      if (candidate) {
        debugLog("stripe customer reuse (email)", {
          email: params.email,
          customer_prefix: safePrefix(candidate.id, 6),
        });
        return candidate.id;
      }
    } catch (error) {
      console.warn("Stripe 顧客検索 (email) に失敗", error);
    }
  }

  return null;
}
