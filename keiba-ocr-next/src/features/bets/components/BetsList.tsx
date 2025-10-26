"use client";

import { useState } from "react";
import { useBetsContext } from "./BetsProvider";
import type { BetRecord } from "@/lib/types";

type BetsListProps = {
  onEdit: (bet: BetRecord) => void;
  onDelete: (bet: BetRecord) => void;
};

const formatCurrency = (value: number) => `¥${value.toLocaleString()}`;

export const BetsList = ({ onEdit, onDelete }: BetsListProps) => {
  const { bets, loading, error } = useBetsContext();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        データを読み込み中です...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-600 shadow-sm">
        {error}
      </div>
    );
  }

  if (!bets.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-slate-600">登録された馬券データがありません。フォームから追加してください。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bets.map((bet) => {
        const isExpanded = expandedId === bet.id;
        return (
          <div key={bet.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{bet.source || "不明"}</p>
                <h3 className="text-lg font-semibold text-slate-900">{bet.raceName || "レース名未設定"}</h3>
                <p className="text-sm text-slate-500">
                  {bet.date ? bet.date : "日付未設定"} / {bet.track || "競馬場不明"} / {bet.bets.length}点
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    bet.recoveryRate >= 100 ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  回収率 {bet.recoveryRate.toFixed(1)}%
                </span>
                <button
                  onClick={() => setExpandedId((prev) => (prev === bet.id ? null : bet.id))}
                  className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                >
                  {isExpanded ? "閉じる" : "詳細"}
                </button>
                <button
                  onClick={() => onEdit(bet)}
                  className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                >
                  編集
                </button>
                <button
                  onClick={() => onDelete(bet)}
                  className="rounded-md border border-rose-200 px-3 py-1 text-sm text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
                >
                  削除
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-6 space-y-4 rounded-lg border border-slate-100 bg-slate-50 p-5">
                <div className="grid grid-cols-1 gap-4 text-sm text-slate-600 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-400">合計購入金額</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{formatCurrency(bet.totalPurchase)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-400">払戻金</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{formatCurrency(bet.payout)}</p>
                  </div>
                  {bet.memo && (
                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium uppercase text-slate-400">メモ</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{bet.memo}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">買い目一覧</p>
                  <div className="mt-3 space-y-2">
                    {bet.bets.map((ticket, index) => (
                      <div
                        key={`${bet.id}-${index}`}
                        className="flex flex-wrap items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
                      >
                        <span className="font-medium text-slate-800">{ticket.type}</span>
                        <span>{ticket.numbers}</span>
                        <span>{formatCurrency(ticket.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {bet.imageUrl && (
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-400">登録画像</p>
                    <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <img src={bet.imageUrl} alt="登録済み画像" className="h-auto w-full" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
