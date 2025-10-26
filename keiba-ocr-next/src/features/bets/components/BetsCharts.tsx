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
                  <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="payoutColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodLabel" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" tickFormatter={formatCurrency} width={90} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(_, items) => items?.[0]?.payload?.periodLabel ?? ""}
              />
              <Legend />
              <Area type="monotone" dataKey="purchase" name="購入金額" stroke="#1d4ed8" fill="url(#purchaseColor)" />
              <Area type="monotone" dataKey="payout" name="払戻金額" stroke="#0ea5e9" fill="url(#payoutColor)" />
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
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" stroke="#94a3b8" tickFormatter={formatCurrency} />
              <YAxis type="category" dataKey="track" stroke="#94a3b8" width={80} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="purchase" name="購入金額" fill="#6366f1" stackId="a" />
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
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="source" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" tickFormatter={(value) => `${value.toFixed(0)}%`} />
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              <Legend />
              <Bar dataKey="recoveryRate" name="回収率" fill="#facc15">
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
  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    <div className="mt-4">{children}</div>
  </div>
);

const EmptyMessage = ({ message }: { message: string }) => (
  <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
    {message}
  </div>
);
