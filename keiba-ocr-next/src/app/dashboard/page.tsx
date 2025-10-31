"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { Database } from "@/types/database";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BuildingStorefrontIcon, CloudArrowUpIcon, TrophyIcon } from "@heroicons/react/24/outline";
import {
  PLAN_FEATURES,
  type CurrentProfile,
  type PlanFeatures,
  getAccountLabel,
  normalizeProfile,
  resolvePlan,
} from "@/lib/plans";
import { redirectToPremiumCheckout } from "@/lib/premiumCheckout";

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
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authLoading, setAuthLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(null);
  const plan = useMemo<PlanFeatures>(() => resolvePlan(currentProfile?.userRole ?? null), [currentProfile?.userRole]);
  const planEnforced = Boolean(currentUser);

  const authCopy = useMemo(() => AUTH_HINTS[authMode], [authMode]);
  const accountLabel = useMemo(
    () => getAccountLabel(currentProfile, currentUser),
    [currentProfile, currentUser],
  );

  const showToast = useCallback((message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handlePremiumUpgrade = useCallback(async () => {
    try {
      await redirectToPremiumCheckout();
    } catch (error) {
      console.error("プレミアム決済ページの開始に失敗しました", error);
      showToast("プレミアム決済ページの読み込みに失敗しました。時間をおいて再度お試しください。", "error");
    }
  }, [showToast]);

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
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [showToast]);

  useEffect(() => {
    let active = true;

    const loadProfile = async (user: User) => {
      try {
        const { data, error } = await supabaseClient
          .from("profiles")
          .select("id, display_name, user_role")
          .eq("id", user.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          throw error;
        }

        setCurrentProfile(normalizeProfile(user, data));
      } catch (profileError) {
        console.error("プロフィール取得エラー", profileError);
        if (active) {
          setCurrentProfile(normalizeProfile(user, null));
        }
      }
    };

    if (!currentUser) {
      setCurrentProfile(null);
      return () => {
        active = false;
      };
    }

    loadProfile(currentUser);

    return () => {
      active = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setProfileModalOpen(false);
      setPasswordModalOpen(false);
    }
  }, [currentUser]);

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

  const handleOpenProfileModal = useCallback(() => {
    setProfileDisplayName(accountLabel);
    setProfileModalOpen(true);
  }, [accountLabel]);

  const handleOpenPasswordModal = useCallback(() => {
    setPasswordModalOpen(true);
  }, []);

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
      } catch (error: unknown) {
        console.error("認証処理エラー", error);
        const message = error instanceof Error ? error.message : "";
        showToast(message || "認証に失敗しました", "error");
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
      } catch (error: unknown) {
        console.error("パスワード再設定エラー", error);
        const message = error instanceof Error ? error.message : "";
        showToast(message || "再設定メールの送信に失敗しました", "error");
      } finally {
        setResetLoading(false);
      }
    },
    [showToast]
  );

  const handleProfileSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedName = profileDisplayName.trim();

      if (!trimmedName) {
        showToast("ユーザー名を入力してください", "error");
        return;
      }

      setProfileLoading(true);
      try {
        const { data, error } = await supabaseClient.auth.updateUser({
          data: {
            display_name: trimmedName,
          },
        });

        if (error) throw error;

        const updatedUser = data.user ?? currentUser;
        if (updatedUser) {
          setCurrentUser(updatedUser);
          await supabaseClient
            .from("profiles")
            .update<Database["public"]["Tables"]["profiles"]["Update"]>({
              display_name: trimmedName,
            })
            .eq("id", updatedUser.id)
            .throwOnError();
          setCurrentProfile((prev) =>
            prev ? { ...prev, displayName: trimmedName } : normalizeProfile(updatedUser, null),
          );
        }

        setProfileModalOpen(false);
        showToast("ユーザー名を更新しました", "success");
      } catch (error: unknown) {
        console.error("プロフィール更新エラー", error);
        const message = error instanceof Error ? error.message : "";
        showToast(message || "ユーザー名の更新に失敗しました", "error");
      } finally {
        setProfileLoading(false);
      }
    },
    [currentUser, profileDisplayName, showToast]
  );

  const handlePasswordChangeSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      const newPassword = String(formData.get("newPassword") || "");
      const confirmPassword = String(formData.get("confirmPassword") || "");

      if (!newPassword) {
        showToast("新しいパスワードを入力してください", "error");
        return;
      }

      if (newPassword.length < 6) {
        showToast("パスワードは6文字以上にしてください", "error");
        return;
      }

      if (newPassword !== confirmPassword) {
        showToast("パスワードが一致しません", "error");
        return;
      }

      setPasswordLoading(true);
      try {
        const { error } = await supabaseClient.auth.updateUser({
          password: newPassword,
        });

        if (error) throw error;

        form.reset();
        setPasswordModalOpen(false);
        showToast("パスワードを更新しました", "success");
      } catch (error: unknown) {
        console.error("パスワード更新エラー", error);
        const message = error instanceof Error ? error.message : "";
        showToast(message || "パスワードの更新に失敗しました", "error");
      } finally {
        setPasswordLoading(false);
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
      <DashboardArea
        onSignOut={handleSignOut}
        plan={plan}
        planEnforced={planEnforced}
        onUpgrade={handlePremiumUpgrade}
      />
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
      <Header
        user={currentUser}
        accountName={accountLabel}
        plan={planEnforced ? plan : undefined}
        onLogin={() => openAuthModal("sign-in")}
        onLogout={handleSignOut}
        onOpenProfile={handleOpenProfileModal}
        onOpenPasswordChange={handleOpenPasswordModal}
        onUpgrade={handlePremiumUpgrade}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-end">
          <Link
            href="/dashboard/bets"
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-transparent px-5 py-2 font-medium text-white transition hover:border-white/40 hover:text-emerald-200"
          >
            馬券管理ページへ
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-5 py-2 font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300"
          >
            トップに戻る
          </Link>
        </div>
        {!currentUser && (
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
                  <p className="font-semibold text-white">OCR & データベース連携</p>
                  <p className="text-slate-300">{accountLabel}</p>
                  {planEnforced ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-emerald-200">
                      <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 font-semibold uppercase tracking-[0.25em]">
                        現在のプラン
                      </span>
                      <span className="inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-500/10 px-3 py-1 font-semibold uppercase tracking-[0.25em]">
                        {plan.label}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">ログインしてプラン情報を確認しましょう。</p>
                  )}
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
                  <p className="font-semibold text-white">OCRで補助解析</p>
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
        )}

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

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-emerald-500/20">
            <h3 className="text-2xl font-semibold text-white">ユーザー名の変更</h3>
            <p className="mt-2 text-sm text-slate-300">
              ダッシュボード上に表示される名前を変更できます。メールアドレスは他のユーザーには表示されません。
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleProfileSubmit}>
              <div className="space-y-1">
                <label htmlFor="profileDisplayName" className="text-sm font-medium text-slate-200">
                  新しいユーザー名
                </label>
                <input
                  id="profileDisplayName"
                  name="profileDisplayName"
                  type="text"
                  value={profileDisplayName}
                  onChange={(event) => setProfileDisplayName(event.target.value)}
                  maxLength={50}
                  className={INPUT_CLASSES}
                  placeholder="例：競馬ファン"
                  autoComplete="name"
                  required
                />
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="w-full rounded-full bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950 shadow-md shadow-emerald-500/30 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {profileLoading ? "更新中..." : "保存する"}
                </button>
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="w-full rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-emerald-500/20">
            <h3 className="text-2xl font-semibold text-white">パスワードの変更</h3>
            <p className="mt-2 text-sm text-slate-300">
              新しいパスワードを設定してください。セキュリティ向上のため英数字を組み合わせた6文字以上のパスワードを推奨します。
            </p>

            <form className="mt-6 space-y-4" onSubmit={handlePasswordChangeSubmit}>
              <div className="space-y-1">
                <label htmlFor="newPassword" className="text-sm font-medium text-slate-200">
                  新しいパスワード
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={INPUT_CLASSES}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-200">
                  パスワード確認
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={INPUT_CLASSES}
                />
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="w-full rounded-full bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950 shadow-md shadow-emerald-500/30 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {passwordLoading ? "更新中..." : "保存する"}
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="w-full rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40"
                >
                  キャンセル
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

type DashboardAreaProps = {
  onSignOut: () => void;
  plan: PlanFeatures;
  planEnforced: boolean;
  onUpgrade?: () => void | Promise<void>;
};

function DashboardArea({ onSignOut, plan, planEnforced, onUpgrade }: DashboardAreaProps) {
  const [editingBet, setEditingBet] = useState<BetRecord | null>(null);
  const [showForm, setShowForm] = useState(true);
  const { deleteBet, fetchBets } = useBetsContext();
  const formSectionRef = useRef<HTMLDivElement | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const premiumPlan = PLAN_FEATURES.premium;

  const handleUpgradeClick = async () => {
    if (!onUpgrade || upgradeLoading) return;

    try {
      setUpgradeLoading(true);
      await onUpgrade();
    } catch (error) {
      console.error("プレミアムアップグレード処理の開始に失敗しました", error);
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleEdit = (bet: BetRecord) => {
    setEditingBet(bet);
    setShowForm(true);
  };

  useEffect(() => {
    if (editingBet && showForm) {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [editingBet, showForm]);

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
            <CardTitle className="text-xl font-semibold text-white">馬券データダッシュボード</CardTitle>
            <CardDescription className="text-sm text-slate-200">
              データベースに保存された馬券データを管理します。フォームで追加・編集・削除ができます。
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
        {planEnforced && (
          <CardContent className="border-t border-white/10">
            <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white shadow-inner shadow-black/10 sm:text-sm">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-slate-900/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">現在のプラン</p>
                  <span className="inline-flex w-fit items-center rounded-full border border-emerald-400/40 bg-emerald-400/15 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-emerald-200">
                    {plan.label}
                  </span>
                  <dl className="mt-2 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="font-medium text-emerald-200">登録上限</dt>
                      <dd className="font-semibold text-white">
                        {plan.maxBets !== null ? `${plan.maxBets}件` : "無制限"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="font-medium text-emerald-200">OCR</dt>
                      <dd className="font-semibold text-white">
                        {plan.ocrEnabled ? plan.ocrUsageLabel : "利用不可"}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="flex flex-col gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">プレミアムプラン</p>
                  <span className="inline-flex w-fit items-center rounded-full border border-emerald-400/50 bg-emerald-400/20 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-emerald-100">
                    {premiumPlan.label}
                  </span>
                  <dl className="mt-2 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="font-medium text-emerald-100">登録上限</dt>
                      <dd className="font-semibold text-white">
                        {premiumPlan.maxBets !== null
                          ? `${premiumPlan.maxBets}件`
                          : "無制限"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="font-medium text-emerald-100">OCR</dt>
                      <dd className="font-semibold text-white">{premiumPlan.ocrUsageLabel}</dd>
                    </div>
                  </dl>
                  {!plan.ocrEnabled && plan.canUpgrade && onUpgrade && (
                    <button
                      type="button"
                      onClick={handleUpgradeClick}
                      disabled={upgradeLoading}
                      className="mt-2 inline-flex items-center justify-center rounded-full border border-emerald-200/50 px-4 py-2 text-[0.7rem] font-semibold text-emerald-100 transition hover:border-emerald-100 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      プレミアムにアップグレード
                    </button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {showForm && (
        <div ref={formSectionRef}>
          <BetsForm
            editingBet={editingBet}
            onCancelEdit={() => setEditingBet(null)}
            onSuccess={handleSuccess}
            plan={plan}
            planEnforced={planEnforced}
            onUpgrade={onUpgrade}
          />
        </div>
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
