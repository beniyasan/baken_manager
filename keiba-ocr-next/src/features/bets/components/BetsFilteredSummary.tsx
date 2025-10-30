"use client";

import { useMemo } from "react";

import { useBetsContext } from "./BetsProvider";

const formatCurrency = (value: number) => `¥${value.toLocaleString()}`;

const formatRecoveryRate = (value: number) => `${value.toFixed(1)}%`;

export const BetsFilteredSummary = () => {
  const { filteredBets, loading } = useBetsContext();

  const { totalPurchase, totalPayout, recoveryRate } = useMemo(() => {
    if (!filteredBets.length) {
      return {
        totalPurchase: 0,
        totalPayout: 0,
        recoveryRate: 0,
      };
    }

    const totals = filteredBets.reduce(
      (acc, bet) => {
        acc.totalPurchase += bet.totalPurchase;
        acc.totalPayout += bet.payout;
        return acc;
      },
      { totalPurchase: 0, totalPayout: 0 },
    );

    const nextRecoveryRate =
      totals.totalPurchase > 0 ? (totals.totalPayout / totals.totalPurchase) * 100 : 0;

    return {
      ...totals,
      recoveryRate: nextRecoveryRate,
    };
  }, [filteredBets]);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl shadow-emerald-500/10">
      <h2 className="text-lg font-semibold text-white">絞り込み結果の集計</h2>
      <p className="mt-1 text-sm text-slate-300">現在の条件に合致する馬券の合計です。</p>

      {loading ? (
        <div className="mt-6 rounded-lg border border-dashed border-slate-700/60 bg-slate-950/40 px-4 py-6 text-center text-sm text-slate-300">
          集計中…
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryStat label="合計購入金額" value={formatCurrency(totalPurchase)} />
          <SummaryStat label="合計払戻金額" value={formatCurrency(totalPayout)} />
          <SummaryStat label="回収率" value={formatRecoveryRate(recoveryRate)} positive={recoveryRate >= 100} />
        </div>
      )}
    </div>
  );
};

const SummaryStat = ({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) => (
  <div className="rounded-lg border border-white/10 bg-slate-950/40 px-4 py-5 text-sm text-slate-200">
    <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
    <p className={`mt-2 text-lg font-semibold ${positive ? "text-emerald-300" : "text-white"}`}>{value}</p>
  </div>
);
