"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import { useBetsContext } from "./BetsProvider";
import { format } from "date-fns";

const formatCurrency = (value: number) => `¥${value.toLocaleString()}`;

export const BetsCharts = () => {
  const { stats } = useBetsContext();

  const timelineData = stats.timeline.map((item) => ({
    ...item,
    recoveryRate: item.purchase > 0 ? (item.payout / item.purchase) * 100 : 0,
    periodLabel: format(new Date(`${item.period}-01`), "yyyy年MM月"),
  }));

  const trackData = stats.byTrack.map((item) => ({
    ...item,
    recoveryRate: item.purchase > 0 ? (item.payout / item.purchase) * 100 : 0,
  }));

  const sourceData = stats.bySource.map((item) => ({
    ...item,
    recoveryRate: item.purchase > 0 ? (item.payout / item.purchase) * 100 : 0,
  }));

  return (
    <div className="space-y-6">
      <ChartCard title="月別購入・払戻の推移">
        {timelineData.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={timelineData}>
              <defs>
                <linearGradient id="purchaseColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="payoutColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="periodLabel" stroke="#cbd5f5" tick={{ fill: "#cbd5f5" }} />
              <YAxis stroke="#cbd5f5" tickFormatter={formatCurrency} tick={{ fill: "#cbd5f5" }} width={90} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(_, items) => items?.[0]?.payload?.periodLabel ?? ""}
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1f2937", color: "#e2e8f0" }}
              />
              <Legend wrapperStyle={{ color: "#e2e8f0" }} />
              <Area type="monotone" dataKey="purchase" name="購入金額" stroke="#22d3ee" fill="url(#purchaseColor)" />
              <Area type="monotone" dataKey="payout" name="払戻金額" stroke="#34d399" fill="url(#payoutColor)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyMessage message="月別のデータが不足しています" />
        )}
      </ChartCard>

      <ChartCard title="競馬場別の購入・払戻">
        {trackData.length ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={trackData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis type="number" stroke="#cbd5f5" tickFormatter={formatCurrency} tick={{ fill: "#cbd5f5" }} />
              <YAxis type="category" dataKey="track" stroke="#cbd5f5" tick={{ fill: "#cbd5f5" }} width={80} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1f2937", color: "#e2e8f0" }}
              />
              <Legend wrapperStyle={{ color: "#e2e8f0" }} />
              <Bar dataKey="purchase" name="購入金額" fill="#22d3ee" stackId="a" />
              <Bar dataKey="payout" name="払戻金額" fill="#34d399" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyMessage message="競馬場ごとのデータが不足しています" />
        )}
      </ChartCard>

      <ChartCard title="購入元別回収率">
        {sourceData.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sourceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="source" stroke="#cbd5f5" tick={{ fill: "#cbd5f5" }} />
              <YAxis stroke="#cbd5f5" tickFormatter={(value) => `${value.toFixed(0)}%`} tick={{ fill: "#cbd5f5" }} />
              <Tooltip
                formatter={(value: number) => `${value.toFixed(1)}%`}
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1f2937", color: "#e2e8f0" }}
              />
              <Legend wrapperStyle={{ color: "#e2e8f0" }} />
              <Bar dataKey="recoveryRate" name="回収率" fill="#22d3ee">
                {/* stacked bars not needed */}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyMessage message="購入元のデータが不足しています" />
        )}
      </ChartCard>
    </div>
  );
};

const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl shadow-emerald-500/10">
    <h3 className="text-lg font-semibold text-white">{title}</h3>
    <div className="mt-4">{children}</div>
  </div>
);

const EmptyMessage = ({ message }: { message: string }) => (
  <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-white/15 bg-slate-950/30 text-sm text-slate-300">
    {message}
  </div>
);
