"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabaseClient";
import { BetsProvider, useBetsContext } from "@/features/bets/components/BetsProvider";
import { BetsList } from "@/features/bets/components/BetsList";
import { BetsForm } from "@/features/bets/components/BetsForm";
import { BetsStats } from "@/features/bets/components/BetsStats";
import { Header } from "@/components/Header";
import type { BetRecord } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BuildingStorefrontIcon, CloudArrowUpIcon, TrophyIcon } from "@heroicons/react/24/outline";

const AUTH_HINTS:
  | Record<
      "sign-in" | "sign-up",
      {
        title: string;
        description: string;
        submit: string;
        note: string;
        switchLabel: string;
        resetVisible: boolean;
      }
    > = {
  "sign-in": {
    title: "ログイン",
    description: "登録済みのメールアドレスとパスワードを入力してください。",
    submit: "ログイン",
    note: "パスワードをお忘れの場合は再設定リンクをご利用ください。",
    switchLabel: "新規登録はこちら",
    resetVisible: true,
  },
  "sign-up": {
    title: "新規登録",
    description: "登録に使用するメールアドレスとパスワードを入力してください。",
    submit: "登録する",
    note: "登録後、確認メールが送信されます。リンクからアカウントを有効化してください。",
    switchLabel: "ログインはこちら",
    resetVisible: false,
  },
};

type ToastState = {
  message: string;
  type: "success" | "error" | "info";
};

const INPUT_CLASSES =
  "w-full rounded-lg border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/30";

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [isResetModalOpen, setResetModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authLoading, setAuthLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const authCopy = useMemo(() => AUTH_HINTS[authMode], [authMode]);

  const showToast = useCallback((message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) {
          console.error("セッション取得エラー", error);
          return;
        }
        if (active) {
          setCurrentUser(data.session?.user ?? null);
        }
      } catch (err) {
        console.error("セッション確認中にエラー", err);
      }
    };

    loadSession();

    const { data: subscription } = supabaseClient.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null;
      setCurrentUser(nextUser);

      if (event === "SIGNED_IN" && nextUser) {
        showToast("ログインしました", "success");
        setAuthModalOpen(false);
      } else if (event === "SIGNED_OUT") {
        showToast("ログアウトしました", "info");
      } else if (event === "USER_UPDATED") {
        showToast("プロフィールを更新しました", "success");
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [showToast]);

  const handleSignOut = useCallback(async () => {
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        throw error;
      }
      router.push("/");
    } catch (error) {
      console.error("ログアウトエラー", error);
      showToast("ログアウトに失敗しました", "error");
    }
  }, [router, showToast]);

  const handleAuthSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const form = event.currentTarget;
      const formData = new FormData(form);
      const email = String(formData.get("email") || "").trim();
      const password = String(formData.get("password") || "");
      const displayName = String(formData.get("displayName") || "").trim();
      const passwordConfirm = String(formData.get("passwordConfirm") || "");

      if (!email || !password) {
        showToast("メールアドレスとパスワードを入力してください", "error");
        return;
      }

      if (authMode === "sign-up" && password.length < 6) {
        showToast("パスワードは6文字以上にしてください", "error");
        return;
      }

      if (authMode === "sign-up" && password !== passwordConfirm) {
        showToast("パスワードが一致しません", "error");
        return;
      }

      setAuthLoading(true);

      try {
        if (authMode === "sign-in") {
          const { error } = await supabaseClient.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          form.reset();
          setAuthModalOpen(false);
        } else {
          const redirectOrigin =
            typeof window !== "undefined" && window.location.origin.startsWith("http")
              ? window.location.origin
              : undefined;

          const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
              data: {
                display_name: displayName || null,
              },
              emailRedirectTo: redirectOrigin,
            },
          });

          if (error) throw error;

          if (data.session?.user) {
            showToast("登録が完了しました", "success");
          } else {
            showToast("確認メールを送信しました。メールをご確認ください。", "info");
          }
          form.reset();
          setAuthModalOpen(false);
          setAuthMode("sign-in");
        }
      } catch (error: any) {
        console.error("認証処理エラー", error);
        showToast(error?.message || "認証に失敗しました", "error");
      } finally {
        setAuthLoading(false);
      }
    },
    [authMode, showToast]
  );

  const handleResetSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      const email = String(formData.get("resetEmail") || "").trim();

      if (!email) {
        showToast("メールアドレスを入力してください", "error");
        return;
      }

      setResetLoading(true);
      try {
        const redirectOrigin =
          typeof window !== "undefined" && window.location.origin.startsWith("http")
            ? window.location.origin
            : undefined;

        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: redirectOrigin,
        });
        if (error) throw error;

        showToast("再設定メールを送信しました。メールをご確認ください。", "info");
        form.reset();
        setResetModalOpen(false);
      } catch (error: any) {
        console.error("パスワード再設定エラー", error);
        showToast(error?.message || "再設定メールの送信に失敗しました", "error");
      } finally {
        setResetLoading(false);
      }
    },
    [showToast]
  );

  const openAuthModal = useCallback((mode: "sign-in" | "sign-up") => {
    setAuthMode(mode);
    setResetModalOpen(false);
    setAuthModalOpen(true);
  }, []);

  const GuardContent = currentUser ? (
    <BetsProvider>
      <DashboardArea onSignOut={handleSignOut} />
    </BetsProvider>
  ) : (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/20 bg-slate-900/60 p-10 text-center shadow-xl shadow-emerald-500/10">
      <h2 className="text-2xl font-semibold text-white">ログインが必要です</h2>
      <p className="max-w-md text-sm text-slate-300">
        ログインすると馬券データの管理・統計機能をご利用いただけます。未登録の方は新規登録をお願いします。
      </p>
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => openAuthModal("sign-in")}
          className="w-48 rounded-full bg-emerald-400 px-5 py-2 text-sm font-medium text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300"
        >
          ログインする
        </button>
        <button
          onClick={() => openAuthModal("sign-up")}
          className="w-48 rounded-full border border-white/20 bg-transparent px-5 py-2 text-sm font-medium text-white transition hover:border-white/40 hover:text-emerald-200"
        >
          新規登録
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header user={currentUser} onLogin={() => openAuthModal("sign-in")} onLogout={handleSignOut} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-white/10 bg-slate-900/60 shadow-lg shadow-emerald-500/10">
            <CardHeader className="border-white/10">
              <CardTitle className="text-base font-semibold text-emerald-200">ステータス</CardTitle>
              <CardDescription className="text-xs text-slate-300">
                現在のログイン状況とOCRの概要。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3 text-sm text-slate-200">
              <CloudArrowUpIcon className="h-10 w-10 text-emerald-300" />
              <div>
                <p className="font-semibold text-white">OCR & Supabase 連携</p>
                <p className="text-slate-300">{currentUser ? currentUser.email : "未ログイン"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-slate-900/60 shadow-lg shadow-emerald-500/10">
            <CardHeader className="border-white/10">
              <CardTitle className="text-base font-semibold text-emerald-200">OCR解析</CardTitle>
              <CardDescription className="text-xs text-slate-300">
                画像アップロードから自動で入力を支援します。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3 text-sm text-slate-200">
              <BuildingStorefrontIcon className="h-10 w-10 text-emerald-300" />
              <div>
                <p className="font-semibold text-white">Vision API + Perplexity で補助解析</p>
                <p className="text-slate-300">買い目や払戻も自動抽出します。</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-slate-900/60 shadow-lg shadow-emerald-500/10">
            <CardHeader className="border-white/10">
              <CardTitle className="text-base font-semibold text-emerald-200">統計と可視化</CardTitle>
              <CardDescription className="text-xs text-slate-300">
                月別推移や競馬場別の傾向をリアルタイム更新。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3 text-sm text-slate-200">
              <TrophyIcon className="h-10 w-10 text-emerald-300" />
              <div>
                <p className="font-semibold text-white">モダンなチャートで動向を把握</p>
                <p className="text-slate-300">購入元別の回収率なども即時確認。</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {GuardContent}
      </main>

      {isAuthModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-emerald-500/20">
            <h3 className="text-2xl font-semibold text-white">{authCopy.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{authCopy.description}</p>

            <form className="mt-6 space-y-4" onSubmit={handleAuthSubmit}>
              {authMode === "sign-up" && (
                <div className="space-y-1">
                  <label htmlFor="displayName" className="text-sm font-medium text-slate-200">
                    表示名（任意）
                  </label>
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    autoComplete="name"
                    className={INPUT_CLASSES}
                  />
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="email" className="text-sm font-medium text-slate-200">
                  メールアドレス
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={INPUT_CLASSES}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="password" className="text-sm font-medium text-slate-200">
                  パスワード
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={authMode === "sign-in" ? "current-password" : "new-password"}
                  required
                  className={INPUT_CLASSES}
                />
              </div>

              {authMode === "sign-up" && (
                <div className="space-y-1">
                  <label htmlFor="passwordConfirm" className="text-sm font-medium text-slate-200">
                    パスワード確認
                  </label>
                  <input
                    id="passwordConfirm"
                    name="passwordConfirm"
                    type="password"
                    required
                    className={INPUT_CLASSES}
                  />
                </div>
              )}

              <p className="text-xs text-slate-300">{authCopy.note}</p>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full rounded-full bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950 shadow-md shadow-emerald-500/30 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {authLoading ? "処理中..." : authCopy.submit}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(false)}
                  className="w-full rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40"
                >
                  キャンセル
                </button>
              </div>
            </form>

            <div className="mt-4 flex flex-col items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setAuthMode((prev) => (prev === "sign-in" ? "sign-up" : "sign-in"))}
                className="text-emerald-200 underline-offset-4 hover:text-emerald-100 hover:underline"
              >
                {authCopy.switchLabel}
              </button>
              {authCopy.resetVisible && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalOpen(false);
                    setResetModalOpen(true);
                  }}
                  className="text-slate-300 underline-offset-4 hover:text-white hover:underline"
                >
                  パスワードをお忘れの方
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isResetModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-emerald-500/20">
            <h3 className="text-2xl font-semibold text-white">パスワード再設定</h3>
            <p className="mt-2 text-sm text-slate-300">
              登録済みのメールアドレスを入力すると、パスワード再設定用のリンクをお送りします。
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleResetSubmit}>
              <div className="space-y-1">
                <label htmlFor="resetEmail" className="text-sm font-medium text-slate-200">
                  メールアドレス
                </label>
                <input
                  id="resetEmail"
                  name="resetEmail"
                  type="email"
                  autoComplete="email"
                  required
                  className={INPUT_CLASSES}
                />
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full rounded-full bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950 shadow-md shadow-emerald-500/30 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {resetLoading ? "送信中..." : "送信する"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetModalOpen(false);
                    setAuthModalOpen(true);
                    setAuthMode("sign-in");
                  }}
                  className="w-full rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40"
                >
                  戻る
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 w-full max-w-xs -translate-x-1/2 rounded-full px-4 py-3 text-sm font-medium text-white shadow-lg transition ${
            toast.type === "success"
              ? "bg-emerald-500"
              : toast.type === "error"
              ? "bg-rose-500"
              : "bg-slate-700"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function DashboardArea({ onSignOut }: { onSignOut: () => void }) {
  const [editingBet, setEditingBet] = useState<BetRecord | null>(null);
  const [showForm, setShowForm] = useState(true);
  const { deleteBet, fetchBets } = useBetsContext();

  const handleEdit = (bet: BetRecord) => {
    setEditingBet(bet);
    setShowForm(true);
  };

  const handleDelete = async (bet: BetRecord) => {
    if (!confirm("このデータを削除してもよろしいですか？")) return;
    try {
      await deleteBet(bet.id, bet.imagePath);
    } catch (error) {
      console.error("削除エラー", error);
      alert("削除に失敗しました");
    }
  };

  const handleSuccess = async () => {
    setEditingBet(null);
    setShowForm(false);
    await fetchBets();
  };

  return (
    <div className="flex min-h-[320px] flex-col gap-6">
      <Card className="border-white/10 bg-slate-900/60 shadow-xl shadow-emerald-500/10">
        <CardHeader className="flex flex-wrap items-center justify-between gap-4 border-white/10">
          <div>
            <CardTitle className="text-xl text-white">馬券データダッシュボード</CardTitle>
            <CardDescription className="text-sm text-slate-300">
              Supabase に保存された馬券データを管理します。フォームで追加・編集・削除ができます。
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onSignOut}
              className="rounded-full border border-white/20 bg-transparent px-4 py-2 text-sm font-medium text-white transition hover:border-white/40 hover:text-emerald-200"
            >
              ログアウト
            </button>
            <button
              onClick={() => setShowForm((prev) => !prev)}
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950 shadow-md shadow-emerald-500/30 transition hover:bg-emerald-300"
            >
              {showForm ? "フォームを隠す" : "フォームを表示"}
            </button>
          </div>
        </CardHeader>
      </Card>

      {showForm && (
        <BetsForm editingBet={editingBet} onCancelEdit={() => setEditingBet(null)} onSuccess={handleSuccess} />
      )}

      <BetsStats />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">登録済み馬券</h2>
        <Link
          href="/dashboard/bets"
          className="text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
        >
          馬券管理ページで全件を見る
        </Link>
      </div>

      <BetsList onEdit={handleEdit} onDelete={handleDelete} maxItems={10} />
    </div>
  );
}
