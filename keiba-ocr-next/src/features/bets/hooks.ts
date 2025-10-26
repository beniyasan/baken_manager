"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import type { BetRecord, BetTicket } from "@/lib/types";

const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "bet-images";

const extractTrackName = (raceName: string | null | undefined) => {
  if (!raceName) return null;
  const trimmed = raceName.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^([^\s(（]+)/);
  return match ? match[1] : null;
};

const getPublicUrl = (path: string | null) => {
  if (!path) return null;
  const { data } = supabaseClient.storage.from(storageBucket).getPublicUrl(path);
  return data?.publicUrl ?? null;
};

const mapRowToBet = (row: any): BetRecord => {
  const betTickets: BetTicket[] = Array.isArray(row?.bets)
    ? row.bets.map((ticket: any) => ({
        type: ticket.type ?? "",
        numbers: ticket.numbers ?? "",
        amount: Number(ticket.amount ?? 0),
      }))
    : [];

  const totalPurchase = Number(row?.amount_bet ?? 0);
  const payout = Number(row?.amount_returned ?? 0);

  return {
    id: String(row?.id ?? ""),
    userId: String(row?.user_id ?? ""),
    date: row?.race_date ?? null,
    source: row?.source ?? "",
    raceName: row?.race_name ?? null,
    track: row?.track ?? null,
    bets: betTickets,
    totalPurchase,
    payout,
    recoveryRate: totalPurchase > 0 ? (payout / totalPurchase) * 100 : 0,
    memo: row?.memo ?? null,
    imagePath: row?.image_path ?? null,
    imageUrl: row?.image_path ? getPublicUrl(row.image_path) : row?.image_data ?? null,
    createdAt: row?.created_at ?? new Date().toISOString(),
  };
};

const mapBetToPayload = (bet: Partial<BetRecord> & { bets: BetTicket[] }) => {
  const totalPurchase = bet.bets.reduce((sum, ticket) => sum + (ticket.amount ?? 0), 0);
  const payout = bet.payout ?? 0;

  return {
    race_date: bet.date ?? null,
    source: bet.source ?? "unknown",
    race_name: bet.raceName ?? null,
    track: bet.track ?? extractTrackName(bet.raceName ?? null),
    ticket_type: bet.bets.length === 1 ? bet.bets[0].type : "multiple",
    amount_bet: totalPurchase,
    amount_returned: payout,
    memo: bet.memo ?? null,
    bets: bet.bets.map((ticket) => ({
      type: ticket.type,
      numbers: ticket.numbers,
      amount: ticket.amount,
    })),
    image_path: bet.imagePath ?? null,
    recovery_rate: totalPurchase > 0 ? (payout / totalPurchase) * 100 : 0,
  };
};

export const useBets = () => {
  const [bets, setBets] = useState<BetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) {
        setBets([]);
        return;
      }

      const { data, error: fetchError } = await supabaseClient
        .from("bets")
        .select("*")
        .eq("user_id", user.id)
        .order("race_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setBets((data ?? []).map(mapRowToBet));
    } catch (fetchErr: any) {
      console.error("馬券データ取得エラー", fetchErr);
      setError(fetchErr?.message ?? "データの取得に失敗しました");
      setBets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const addBet = useCallback(async (bet: Partial<BetRecord> & { bets: BetTicket[] }) => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("ログインが必要です");

    const payload = {
      ...mapBetToPayload(bet),
      user_id: user.id,
    };

    const { data, error: insertError } = await supabaseClient
      .from("bets")
      .insert(payload)
      .select()
      .single();

    if (insertError) throw insertError;

    setBets((prev) => [mapRowToBet(data), ...prev]);
  }, []);

  const updateBet = useCallback(async (id: string, bet: Partial<BetRecord> & { bets: BetTicket[] }) => {
    const payload = mapBetToPayload(bet);

    const { data, error: updateError } = await supabaseClient
      .from("bets")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    setBets((prev) => prev.map((record) => (record.id === id ? mapRowToBet(data) : record)));
  }, []);

  const deleteBet = useCallback(async (id: string, imagePath?: string | null) => {
    if (imagePath) {
      await supabaseClient.storage.from(storageBucket).remove([imagePath]).catch(() => undefined);
    }

    const { error: deleteError } = await supabaseClient.from("bets").delete().eq("id", id);
    if (deleteError) throw deleteError;

    setBets((prev) => prev.filter((record) => record.id !== id));
  }, []);

  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

  const stats = useMemo(() => {
    if (loading || !bets.length) {
      return {
        totalPurchase: 0,
        totalPayout: 0,
        avgRecoveryRate: 0,
        raceCount: 0,
        hitCount: 0,
        hitRate: 0,
        timeline: [] as Array<{ period: string; purchase: number; payout: number }>,
        byTrack: [] as Array<{ track: string; purchase: number; payout: number }>,
        bySource: [] as Array<{ source: string; purchase: number; payout: number }>,
      };
    }

    const totalPurchase = bets.reduce((sum, bet) => sum + bet.totalPurchase, 0);
    const totalPayout = bets.reduce((sum, bet) => sum + bet.payout, 0);
    const avgRecoveryRate = totalPurchase > 0 ? (totalPayout / totalPurchase) * 100 : 0;
    const raceCount = bets.length;
    const hitCount = bets.filter((bet) => bet.payout > 0).length;
    const hitRate = raceCount > 0 ? (hitCount / raceCount) * 100 : 0;

    const timelineMap = new Map<string, { purchase: number; payout: number }>();
    const trackMap = new Map<string, { purchase: number; payout: number }>();
    const sourceMap = new Map<string, { purchase: number; payout: number }>();

    bets.forEach((bet) => {
      if (bet.date) {
        const month = bet.date.slice(0, 7);
        if (!timelineMap.has(month)) {
          timelineMap.set(month, { purchase: 0, payout: 0 });
        }
        const entry = timelineMap.get(month)!;
        entry.purchase += bet.totalPurchase;
        entry.payout += bet.payout;
      }

      const track = bet.track || "その他";
      if (!trackMap.has(track)) {
        trackMap.set(track, { purchase: 0, payout: 0 });
      }
      const trackEntry = trackMap.get(track)!;
      trackEntry.purchase += bet.totalPurchase;
      trackEntry.payout += bet.payout;

      const source = bet.source || "その他";
      if (!sourceMap.has(source)) {
        sourceMap.set(source, { purchase: 0, payout: 0 });
      }
      const sourceEntry = sourceMap.get(source)!;
      sourceEntry.purchase += bet.totalPurchase;
      sourceEntry.payout += bet.payout;
    });

    const timeline = Array.from(timelineMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([period, value]) => ({ period, ...value }));

    const byTrack = Array.from(trackMap.entries())
      .map(([track, value]) => ({ track, ...value }))
      .sort((a, b) => b.purchase - a.purchase)
      .slice(0, 8);

    const bySource = Array.from(sourceMap.entries()).map(([source, value]) => ({ source, ...value }));

    return {
      totalPurchase,
      totalPayout,
      avgRecoveryRate,
      raceCount,
      hitCount,
      hitRate,
      timeline,
      byTrack,
      bySource,
    };
  }, [bets, loading]);

  return {
    bets,
    loading,
    error,
    stats,
    fetchBets,
    addBet,
    updateBet,
    deleteBet,
  };
};
