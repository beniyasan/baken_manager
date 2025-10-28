"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { BetsProvider } from "@/features/bets/components/BetsProvider";
import { BetsTable } from "@/features/bets/components/BetsTable";

export default function BetsManagementPage() {
  return (
    <AuthGuard>
      <BetsProvider>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">Bets Management</p>
              <h1 className="text-2xl font-semibold text-white">馬券管理一覧</h1>
              <p className="text-sm text-slate-300">
                登録済みの馬券を1点ずつテーブル形式で確認できます。
              </p>
            </div>
            <Link
              href="/dashboard"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/40 hover:text-white"
            >
              ダッシュボードに戻る
            </Link>
          </div>

          <BetsTable />
        </div>
      </BetsProvider>
    </AuthGuard>
  );
}
