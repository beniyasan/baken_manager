"use client";

import { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";

import { useBetsContext } from "./BetsProvider";

const HEADERS = [
  "購入日",
  "レース情報",
  "情報源",
  "買い目種別",
  "買い目内容",
  "買い目金額",
  "合計購入",
  "払戻金",
  "回収率",
  "メモ",
];

const formatRaceInfo = (raceName: string | null, track: string | null) => {
  if (raceName && track) {
    return `${raceName} (${track})`;
  }
  if (raceName) {
    return raceName;
  }
  if (track) {
    return track;
  }
  return "未設定";
};

const needsWrapping = (value: string) => /[",\r\n]/.test(value);

const escapeCell = (value: string) => {
  const sanitized = value.replace(/"/g, '""');
  return needsWrapping(sanitized) ? `"${sanitized}"` : sanitized;
};

export const BetsExportButton = () => {
  const { filteredBets, loading } = useBetsContext();
  const [exporting, setExporting] = useState(false);

  const rows = useMemo(() => {
    const flattened: string[][] = [];

    filteredBets.forEach((bet) => {
      const tickets = bet.bets.length ? bet.bets : [null];

      tickets.forEach((ticket, index) => {
        const isFirstTicket = index === 0;

        flattened.push([
          isFirstTicket ? bet.date ?? "日付未設定" : "",
          isFirstTicket ? formatRaceInfo(bet.raceName, bet.track) : "",
          isFirstTicket ? (bet.source || "不明") : "",
          ticket ? ticket.type || "買い目未登録" : "買い目未登録",
          ticket ? ticket.numbers || "-" : "-",
          ticket ? String(ticket.amount) : "-",
          isFirstTicket ? String(bet.totalPurchase) : "",
          isFirstTicket ? String(bet.payout) : "",
          isFirstTicket ? `${bet.recoveryRate.toFixed(1)}%` : "",
          isFirstTicket ? bet.memo ?? "" : "",
        ]);
      });
    });

    return flattened;
  }, [filteredBets]);

  const handleExport = useCallback(() => {
    if (!rows.length) {
      return;
    }

    setExporting(true);
    try {
      const csvContent = [HEADERS, ...rows]
        .map((row) => row.map((cell) => escapeCell(cell)).join(","))
        .join("\r\n");

      const fileName = `bets_${format(new Date(), "yyyyMMddHHmmss")}.csv`;
      const blob = new Blob([`\ufeff${csvContent}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } finally {
      setExporting(false);
    }
  }, [rows]);

  const disabled = exporting || loading || rows.length === 0;

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-full border border-white/20 bg-slate-950/60 px-5 py-2 text-sm font-medium text-white transition hover:border-emerald-300/60 hover:text-emerald-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-400"
    >
      {exporting ? "エクスポート中…" : "CSVエクスポート"}
    </button>
  );
};
