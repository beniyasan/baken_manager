"use client";

import { useState } from "react";
import { useBetsContext } from "./BetsProvider";
import type { BetRecord } from "@/lib/types";

type BetsListProps = {
  onEdit: (bet: BetRecord) => void;
  onDelete: (bet: BetRecord) => void;
};

const formatCurrency = (value: number) => `¥${value.toLocaleString()}`;

const ACTION_BUTTON_CLASS =
  "rounded-md border border-white/20 px-3 py-1 text-sm text-slate-200 transition hover:border-white/40 hover:text-white";
const DANGER_BUTTON_CLASS =
  "rounded-md border border-rose-400/60 px-3 py-1 text-sm text-rose-200 transition hover:border-rose-300 hover:text-rose-100";

export const BetsList = ({ onEdit, onDelete }: BetsListProps) => {
  const { bets, loading, error } = useBetsContext();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center text-sm text-slate-200 shadow-xl shadow-emerald-500/10">
        データを読み込み中です...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center text-sm text-rose-200 shadow-xl">
        {error}
      </div>
    );
  }

  if (!bets.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/30 p-10 text-center shadow-xl shadow-emerald-500/10">
        <p className="text-sm text-slate-300">登録された馬券データがありません。フォームから追加してください。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bets.map((bet) => {
        const isExpanded = expandedId === bet.id;
        return (
          <div
            key={bet.id}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-lg shadow-emerald-500/10 transition hover:shadow-emerald-500/20"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">{bet.source || "不明"}</p>
                <h3 className="text-lg font-semibold text-white">{bet.raceName || "レース名未設定"}</h3>
                <p className="text-sm text-slate-300">
                  {bet.date ? bet.date : "日付未設定"} / {bet.track || "競馬場不明"} / {bet.bets.length}点
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    bet.recoveryRate >= 100
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "bg-white/10 text-slate-200"
                  }`}
                >
                  回収率 {bet.recoveryRate.toFixed(1)}%
                </span>
                <button
                  onClick={() => setExpandedId((prev) => (prev === bet.id ? null : bet.id))}
                  className={ACTION_BUTTON_CLASS}
                >
                  {isExpanded ? "閉じる" : "詳細"}
                </button>
                <button onClick={() => onEdit(bet)} className={ACTION_BUTTON_CLASS}>
                  編集
                </button>
                <button onClick={() => onDelete(bet)} className={DANGER_BUTTON_CLASS}>
                  削除
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-6 space-y-4 rounded-lg border border-white/10 bg-slate-950/40 p-5">
                <div className="grid grid-cols-1 gap-4 text-sm text-slate-200 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-400">合計購入金額</p>
                    <p className="mt-1 text-base font-semibold text-white">{formatCurrency(bet.totalPurchase)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-400">払戻金</p>
                    <p className="mt-1 text-base font-semibold text-white">{formatCurrency(bet.payout)}</p>
                  </div>
                  {bet.memo && (
                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium uppercase text-slate-400">メモ</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{bet.memo}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">買い目一覧</p>
                  <div className="mt-3 space-y-2">
                    {bet.bets.map((ticket, index) => (
                      <div
                        key={`${bet.id}-${index}`}
                        className="flex flex-wrap items-center justify-between rounded-md border border-white/15 bg-slate-950/30 px-3 py-2 text-sm text-slate-200"
                      >
                        <span className="font-medium text-white">{ticket.type}</span>
                        <span>{ticket.numbers}</span>
                        <span>{formatCurrency(ticket.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {bet.imageUrl && (
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-400">登録画像</p>
                    <div className="mt-2 overflow-hidden rounded-lg border border-white/15 bg-slate-950/30">
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
