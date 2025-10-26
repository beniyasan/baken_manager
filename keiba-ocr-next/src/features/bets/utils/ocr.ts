const raceCourses = [
  "大井",
  "川崎",
  "船橋",
  "浦和",
  "東京",
  "中山",
  "阪神",
  "京都",
  "中京",
  "新潟",
  "福島",
  "小倉",
  "札幌",
  "函館",
  "園田",
  "姫路",
  "門別",
  "盛岡",
  "水沢",
  "金沢",
  "笠松",
  "名古屋",
  "帯広",
  "高知",
  "佐賀",
];

const BET_TYPES = [
  "単勝",
  "複勝",
  "枠連",
  "枠単",
  "枠複",
  "馬連",
  "馬単",
  "ワイド",
  "3連複",
  "3連単",
];

export type ParsedOcrResult = {
  date?: string;
  source?: string;
  raceName?: string;
  track?: string;
  payout?: number;
  bets: Array<{ type: string; numbers: string; amount: number }>;
  memo?: string;
};

export type StructuredOcrResult = {
  date?: string | null;
  source?: string | null;
  raceName?: string | null;
  track?: string | null;
  payout?: number | null;
  bets?: Array<{ type?: string; numbers?: string[]; amount?: number }>;
  memo?: string | null;
};

const normalizeOcrText = (rawText: string) => {
  if (!rawText) return "";
  let normalized = rawText;

  const replacements: Array<[RegExp, string]> = [
    [/三較/g, "三連"],
    [/三練/g, "三連"],
    [/三鎌/g, "三連"],
    [/三絵/g, "三連"],
    [/馬ノ/g, "馬の"],
    [/￥/g, "円"],
  ];
  replacements.forEach(([pattern, value]) => {
    normalized = normalized.replace(pattern, value);
  });

  normalized = normalized.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xff10 + 48));
  normalized = normalized.replace(/[Ａ-Ｚ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xff21 + 65));
  normalized = normalized.replace(/[ａ-ｚ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xff41 + 97));
  normalized = normalized.replace(/[／⁄]/g, "/");
  normalized = normalized.replace(/ＳＰＡＴ/g, "SPAT");
  normalized = normalized.replace(/ｓｐａｔ/g, "spat");
  normalized = normalized.replace(/\|(?=\d)/g, " ");
  normalized = normalized.replace(/\|(?!\s)/g, " | ");
  normalized = normalized.replace(/(\d)[っつづッﾂ](\d)(?=\d)/g, "$1っ$2っ");
  return normalized;
};

export const parseOcrText = (rawText: string): ParsedOcrResult => {
  const text = normalizeOcrText(rawText);
  const result: ParsedOcrResult = { bets: [] };

  const datePatterns = [
    /(\d{4})年(\d{1,2})月(\d{1,2})日/,
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/,
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const [, year, month, day] = match;
      result.date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      break;
    }
  }

  if (text.includes("SPAT4") || text.includes("Spat4")) {
    result.source = "Spat4";
  } else if (text.includes("即pat") || text.includes("即PAT") || text.includes("iPAT")) {
    result.source = "即pat";
  }

  const racePattern = new RegExp(`(${raceCourses.join("|")})\s*(\d{1,2})R`);
  const raceMatch = text.match(racePattern);
  if (raceMatch) {
    result.track = raceMatch[1];
    result.raceName = `${raceMatch[1]} ${raceMatch[2]}R`;
  }

  const payoutPattern = /払戻.*?(\d{1,3}(?:,\d{3})*)円/;
  const payoutMatch = text.match(payoutPattern);
  if (payoutMatch) {
    result.payout = parseInt(payoutMatch[1].replace(/,/g, ""), 10);
  }

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const tickets: ParsedOcrResult["bets"] = [];

  for (const line of lines) {
    const betType = BET_TYPES.find((type) => line.includes(type));
    if (!betType) continue;

    const numbersMatch = line.match(/(\d+(?:[-→ー]\d+)*)/);
    const amountMatch = line.match(/(\d{1,3}(?:,\d{3})*)円/);

    if (numbersMatch && amountMatch) {
      tickets.push({
        type: betType,
        numbers: numbersMatch[1].replace(/[→ー]/g, "-"),
        amount: parseInt(amountMatch[1].replace(/,/g, ""), 10),
      });
    }
  }

  if (!tickets.length) {
    const fallbackMatches = text.match(/(\d+(?:[-→ー]\d+)*)\s+(\d{1,3}(?:,\d{3})*)円/g);
    if (fallbackMatches) {
      fallbackMatches.forEach((match) => {
        const numbersMatch = match.match(/(\d+(?:[-→ー]\d+)*)/);
        const amountMatch = match.match(/(\d{1,3}(?:,\d{3})*)円/);
        if (numbersMatch && amountMatch) {
          tickets.push({
            type: tickets[0]?.type ?? "その他",
            numbers: numbersMatch[1].replace(/[→ー]/g, "-"),
            amount: parseInt(amountMatch[1].replace(/,/g, ""), 10),
          });
        }
      });
    }
  }

  result.bets = tickets;
  return result;
};

export const mergeOcrResults = (base: ParsedOcrResult, structured?: StructuredOcrResult): ParsedOcrResult => {
  if (!structured) return base;

  const merged: ParsedOcrResult = {
    bets: [...base.bets],
  };

  merged.date = structured.date ?? base.date;
  merged.source = structured.source ?? base.source;
  merged.raceName = structured.raceName ?? base.raceName;
  merged.track = structured.track ?? base.track;
  merged.payout = typeof structured.payout === "number" ? structured.payout : base.payout;
  merged.memo = structured.memo ?? base.memo;

  if (structured.bets && structured.bets.length) {
    merged.bets = structured.bets
      .map((ticket) => {
        const numbers = Array.isArray(ticket.numbers) && ticket.numbers.length
          ? ticket.numbers.join("-")
          : "";
        const amount = typeof ticket.amount === "number" ? ticket.amount : 0;
        const type = ticket.type ?? "その他";
        if (!numbers || amount <= 0) return null;
        return { type, numbers, amount };
      })
      .filter((ticket): ticket is { type: string; numbers: string; amount: number } => Boolean(ticket));

    if (!merged.bets.length) {
      merged.bets = [...base.bets];
    }
  }

  if (!merged.track && merged.raceName) {
    const match = merged.raceName.match(/^([^\s]+)/);
    if (match) {
      merged.track = match[1];
    }
  }

  return merged;
};
