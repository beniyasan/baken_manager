export type BetTicket = {
  type: string;
  numbers: string;
  amount: number;
};

export type BetRecord = {
  id: string;
  userId: string;
  date: string | null;
  source: string;
  raceName: string | null;
  track: string | null;
  bets: BetTicket[];
  totalPurchase: number;
  payout: number;
  recoveryRate: number;
  memo: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  createdAt: string;
};
