"use client";

import { useBetsContext } from "./BetsProvider";
import { BetsCharts } from "./BetsCharts";

const formatCurrency = (value: number) => `¥${value.toLocaleString()}`;

export const BetsStats = () => {
  const { stats } = useBetsContext();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl shadow-emerald-500/10">
        <h2 className="text-lg font-semibold text-white">統計サマリー</h2>
        <p className="mt-1 text-sm text-slate-300">主要な指標を一覧化しました。</p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="総購入金額" value={formatCurrency(stats.totalPurchase)} />
          <StatCard label="総払戻金額" value={formatCurrency(stats.totalPayout)} />
          <StatCard
            label="平均回収率"
            value={`${stats.avgRecoveryRate.toFixed(1)}%`}
            positive={stats.avgRecoveryRate >= 100}
          />
          <StatCard label="レース数" value={`${stats.raceCount} 件`} />
          <StatCard label="的中回数" value={`${stats.hitCount} 件`} />
          <StatCard label="的中率" value={`${stats.hitRate.toFixed(1)}%`} />
        </div>
      </div>

      <BetsCharts />
    </div>
  );
};

const StatCard = ({
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
