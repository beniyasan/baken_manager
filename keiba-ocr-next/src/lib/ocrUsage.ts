const TOKYO_TIME_ZONE = "Asia/Tokyo";

export type OcrUsageSnapshot = {
  limit: number | null;
  used: number;
  remaining: number | null;
  resetAt: string | null;
};

const pad = (value: number) => value.toString().padStart(2, "0");

const getTokyoDateParts = (date: Date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TOKYO_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? date.getFullYear());
  const month = Number(parts.find((part) => part.type === "month")?.value ?? date.getMonth() + 1);
  const day = Number(parts.find((part) => part.type === "day")?.value ?? date.getDate());
  return { year, month, day };
};

export const getUsageMonthKey = (date: Date = new Date()) => {
  const { year, month } = getTokyoDateParts(date);
  return `${year}-${pad(month)}-01`;
};

export const getNextResetIsoString = (date: Date = new Date()) => {
  const { year, month } = getTokyoDateParts(date);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const utcDate = new Date(Date.UTC(nextYear, nextMonth - 1, 1, -9, 0, 0, 0));
  return utcDate.toISOString();
};

export const buildUsageSnapshot = (options: {
  limit: number | null;
  used: number | null | undefined;
  date?: Date;
}): OcrUsageSnapshot => {
  const { limit, used: rawUsed, date = new Date() } = options;
  const used = rawUsed ?? 0;
  if (limit === null) {
    return {
      limit: null,
      used,
      remaining: null,
      resetAt: null,
    };
  }

  const nextReset = getNextResetIsoString(date);
  const remaining = Math.max(limit - used, 0);
  return {
    limit,
    used,
    remaining,
    resetAt: nextReset,
  };
};
