"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { PlanFeatures } from "@/lib/plans";

export type HeaderProps = {
  user: User | null;
  accountName?: string;
  plan?: PlanFeatures;
  onLogin: () => void;
  onLogout: () => void;
  onOpenProfile?: () => void;
  onOpenPasswordChange?: () => void;
  onUpgrade?: () => void | Promise<void>;
};

const getDisplayName = (user: User | null) => {
  if (!user) return "未ログイン";
  const nickname = String(user.user_metadata?.display_name || "").trim();
  return nickname || user.email || "未ログイン";
};

export const Header = ({
  user,
  accountName,
  plan,
  onLogin,
  onLogout,
  onOpenProfile,
  onOpenPasswordChange,
  onUpgrade,
}: HeaderProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const displayName = accountName ?? getDisplayName(user);
  const isFreePlan = plan?.role === "free";
  const canUpgrade = isFreePlan && Boolean(onUpgrade);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 text-white">
        <div className="space-y-2">
          <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Keiba OCR Manager
          </span>
          <h1 className="text-2xl font-semibold text-white">馬券管理ダッシュボード</h1>
          <p className="text-sm text-slate-300">
            アップロードした馬券の管理・統計をリアルタイムに可視化。OCRで自動入力も可能です。
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden flex-col text-right text-slate-300 md:flex">
            <span className="text-xs uppercase tracking-wide text-slate-400">アカウント</span>
            <span className="text-sm font-medium text-white">{displayName}</span>
            {user && plan && (
              <span className="mt-1 inline-flex items-center justify-end gap-2 text-[11px] uppercase tracking-[0.25em] text-emerald-300">
                {plan.label}
              </span>
            )}
          </div>
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/20"
              >
                <span className="hidden sm:inline">{displayName}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className={`h-4 w-4 transition-transform ${menuOpen ? "rotate-180" : "rotate-0"}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-slate-900/95 p-2 text-sm text-slate-200 shadow-lg">
                  <div className="px-3 pb-2 pt-1">
                    <p className="text-xs uppercase tracking-wide text-slate-400">ログイン中</p>
                    <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                    {user.email && (
                      <p className="truncate text-xs text-slate-400">{user.email}</p>
                    )}
                    {plan && (
                      <p className="mt-1 text-xs text-emerald-200">{plan.label}</p>
                    )}
                  </div>
                  {onOpenProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenProfile();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10"
                    >
                      ユーザー名を変更
                    </button>
                  )}
                  {onOpenPasswordChange && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenPasswordChange();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10"
                    >
                      パスワードを変更
                    </button>
                  )}
                  {canUpgrade && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        void onUpgrade?.();
                      }}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-emerald-200 hover:bg-white/10"
                    >
                      プレミアムにアップグレード
                    </button>
                  )}
                  <div className="my-1 border-t border-white/10" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                  >
                    ログアウト
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-medium text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300"
            >
              ログイン
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
