"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Header } from "@/components/Header";
import { supabaseClient } from "@/lib/supabaseClient";
import { BetsProvider } from "@/features/bets/components/BetsProvider";
import { BetsTable } from "@/features/bets/components/BetsTable";
import { getAccountLabel, normalizeProfile, resolvePlan, type PlanFeatures } from "@/lib/plans";

export default function BetsManagementPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountName, setAccountName] = useState("未ログイン");
  const [plan, setPlan] = useState<PlanFeatures>(resolvePlan(null));

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;

        if (!active) return;

        const nextUser = data.session?.user ?? null;
        setUser(nextUser);

        if (!nextUser) {
          setAccountName("未ログイン");
          setPlan(resolvePlan(null));
          router.replace("/dashboard");
          return;
        }

        await loadProfile(nextUser);
      } catch (error) {
        console.error("馬券管理ページのセッション取得エラー", error);
        if (active) {
          setUser(null);
          setAccountName("未ログイン");
          setPlan(resolvePlan(null));
          router.replace("/dashboard");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const loadProfile = async (targetUser: User) => {
      try {
        const { data, error } = await supabaseClient
          .from("profiles")
          .select("id, display_name, user_role")
          .eq("id", targetUser.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          throw error;
        }

        const normalized = normalizeProfile(targetUser, data);
        setAccountName(getAccountLabel(normalized, targetUser));
        setPlan(resolvePlan(normalized?.userRole ?? null));
      } catch (profileError) {
        console.error("馬券管理ページのプロフィール取得エラー", profileError);
        if (!active) return;
        const fallback = normalizeProfile(targetUser, null);
        setAccountName(getAccountLabel(fallback, targetUser));
        setPlan(resolvePlan(fallback?.userRole ?? null));
      }
    };

    initialize();

    const { data: subscription } = supabaseClient.auth.onAuthStateChange((_, session) => {
      if (!active) return;

      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setAccountName("未ログイン");
        setPlan(resolvePlan(null));
        router.replace("/dashboard");
      } else {
        loadProfile(nextUser);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  const handleSignOut = useCallback(async () => {
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      router.replace("/");
    } catch (error) {
      console.error("馬券管理ページのサインアウトエラー", error);
    }
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="flex h-screen items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-400" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header
        user={user}
        accountName={accountName}
        plan={user ? plan : undefined}
        onLogin={() => router.push("/dashboard")}
        onLogout={handleSignOut}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
        <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-xl shadow-emerald-500/10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <p className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
                Bets Overview
              </p>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold text-white">馬券管理一覧</h1>
                <p className="text-sm text-slate-300">
                  登録済みの馬券を1点ずつテーブル形式で確認できます。
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-transparent px-5 py-2 font-medium text-white transition hover:border-white/40 hover:text-emerald-200"
              >
                ダッシュボードに戻る
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-5 py-2 font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300"
              >
                トップに戻る
              </Link>
            </div>
          </div>
        </section>

        <BetsProvider>
          <BetsTable />
        </BetsProvider>
      </main>
    </div>
  );
}
