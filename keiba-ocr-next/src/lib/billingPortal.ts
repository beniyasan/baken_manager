"use client";

export const redirectToBillingPortal = async (): Promise<void> => {
  if (typeof window === "undefined") {
    throw new Error("Billing portal redirect is only available in the browser");
  }

  const response = await fetch("/api/billing/portal", {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as
    | {
        url?: string;
        error?: string;
      }
    | null;

  if (!response.ok) {
    const message = data?.error || `Failed to create billing portal session (status ${response.status})`;
    throw new Error(message);
  }

  if (!data?.url) {
    throw new Error("Billing portal session did not return a redirect URL");
  }

  window.location.assign(data.url);
};
