"use client";

import { useCallback, useState } from "react";

import { redirectToPremiumCheckout } from "@/lib/premiumCheckout";
import { cn } from "@/lib/utils";

type RetryPremiumCheckoutButtonProps = {
  className?: string;
};

export const RetryPremiumCheckoutButton = ({
  className,
}: RetryPremiumCheckoutButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    try {
      setLoading(true);
      await redirectToPremiumCheckout();
    } catch (error) {
      console.error("プレミアム決済ページの再開に失敗しました", error);
      window.alert("決済ページの読み込みに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-70",
        className,
      )}
    >
      {loading ? "読み込み中..." : "決済を再開する"}
    </button>
  );
};
