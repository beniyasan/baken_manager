"use client";

export type CheckoutSessionResponse = {
  url?: string;
};

export const redirectToPremiumCheckout = async (): Promise<void> => {
  if (typeof window === "undefined") {
    throw new Error("Checkout redirect is only available in the browser");
  }

  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      errorText || `Failed to create checkout session (status ${response.status})`,
    );
  }

  const data = (await response.json()) as CheckoutSessionResponse;

  if (!data?.url) {
    throw new Error("Checkout session was created without a redirect URL");
  }

  window.location.href = data.url;
};
