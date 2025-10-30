"use client";

import { type ReactNode, useMemo } from "react";
import type { BetRecord } from "@/lib/types";
import { useBetsContext } from "./BetsProvider";

const formatCurrency = (value: number) => `¥${value.toLocaleString()}`;

type BetsTableProps = {
  onEdit?: (bet: BetRecord) => void;
  showActions?: boolean;
};

export const BetsTable = ({ onEdit, showActions = Boolean(onEdit) }: BetsTableProps) => {
  const { bets, loading, error } = useBetsContext();

  const { rows, totalRowCount } = useMemo(() => {
    const renderedRows: ReactNode[] = [];
    let rowIndex = 0;

    bets.forEach((bet) => {
      const tickets = bet.bets.length ? bet.bets : [null];
      const rowSpan = tickets.length;

      tickets.forEach((ticket, index) => {
        const isFirstTicket = index === 0;
        const rowClass =
          rowIndex % 2 === 0
            ? "bg-slate-950/40"
            : "bg-slate-950/20";

        renderedRows.push(
          <tr
            key={`${bet.id}-${index}`}
            className={`${rowClass} border-b border-white/10 text-sm text-slate-200 transition hover:bg-slate-800/30`}
          >
            {isFirstTicket && (
              <td className="whitespace-nowrap px-4 py-3 text-sm" rowSpan={rowSpan}>
                <span className="font-medium text-white">{bet.date || "日付未設定"}</span>
              </td>
            )}
            {isFirstTicket && (
              <td className="px-4 py-3" rowSpan={rowSpan}>
                <div className="space-y-1">
                  <p className="font-semibold text-white">{bet.raceName || "レース名未設定"}</p>
                  <p className="text-xs text-slate-400">{bet.track || "競馬場未設定"}</p>
                  {bet.memo && (
                    <p className="text-xs text-slate-400">メモ: {bet.memo}</p>
                  )}
                </div>
              </td>
            )}
            {isFirstTicket && (
              <td className="whitespace-nowrap px-4 py-3 text-xs uppercase tracking-[0.2em] text-emerald-200" rowSpan={rowSpan}>
                {bet.source || "不明"}
              </td>
            )}
            <td className="whitespace-nowrap px-4 py-3 font-medium text-white">
              {ticket ? ticket.type : "買い目未登録"}
            </td>
            <td className="px-4 py-3">
              {ticket ? ticket.numbers : "-"}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-white">
              {ticket ? formatCurrency(ticket.amount) : "-"}
            </td>
            {isFirstTicket && (
              <td className="whitespace-nowrap px-4 py-3 text-right text-slate-200" rowSpan={rowSpan}>
                {formatCurrency(bet.totalPurchase)}
              </td>
            )}
            {isFirstTicket && (
              <td className="whitespace-nowrap px-4 py-3 text-right text-slate-200" rowSpan={rowSpan}>
                {formatCurrency(bet.payout)}
              </td>
            )}
            {isFirstTicket && (
              <td className="whitespace-nowrap px-4 py-3 text-right" rowSpan={rowSpan}>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    bet.recoveryRate >= 100
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "bg-white/10 text-slate-200"
                  }`}
                >
                  {bet.recoveryRate.toFixed(1)}%
                </span>
              </td>
            )}
            {isFirstTicket && showActions && (
              <td className="whitespace-nowrap px-4 py-3 text-right" rowSpan={rowSpan}>
                <button
                  type="button"
                  onClick={() => onEdit?.(bet)}
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-1 text-xs font-medium text-white transition hover:border-emerald-300/50 hover:text-emerald-200"
                >
                  編集
                </button>
              </td>
            )}
          </tr>
        );

        rowIndex += 1;
      });
    });

    return { rows: renderedRows, totalRowCount: rowIndex };
  }, [bets, onEdit, showActions]);

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
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl shadow-emerald-500/10">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-slate-950/50 text-xs uppercase tracking-[0.2em] text-slate-300">
            <tr>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-left font-medium">
                購入日
              </th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-left font-medium">
                レース情報
              </th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-left font-medium">
                情報源
              </th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-left font-medium">
                買い目種別
              </th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-left font-medium">
                買い目内容
              </th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-medium">
                購入金額
              </th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-medium">
                合計購入
              </th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-medium">
                払戻金
              </th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-medium">
                回収率
              </th>
              {showActions && (
                <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-medium">
                  操作
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows}
          </tbody>
        </table>
      </div>
      <div className="border-t border-white/10 px-4 py-3 text-right text-xs text-slate-400">
        全 {totalRowCount} 点を表示中
      </div>
    </div>
  );
};
