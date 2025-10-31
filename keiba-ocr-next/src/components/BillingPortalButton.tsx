"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export function BillingPortalButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    try {
      setError(null);
      setLoading(true);

      const response = await fetch("/api/billing/portal", {
        method: "POST",
      });

      const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "請求ポータルの取得に失敗しました");
      }

      if (!data?.url) {
        throw new Error("請求ポータルのURLを取得できませんでした");
      }

      window.location.assign(data.url);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "請求ポータルを開く際に予期せぬエラーが発生しました";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-2 text-sm font-semibold text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {loading ? "読み込み中..." : "請求ポータルを開く"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
