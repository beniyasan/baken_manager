"use client";

import type { User } from "@supabase/supabase-js";

export type HeaderProps = {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
};

export const Header = ({ user, onLogin, onLogout }: HeaderProps) => {
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
            <span className="text-sm font-medium text-white">{user ? user.email : "未ログイン"}</span>
          </div>
          {user ? (
            <button
              onClick={onLogout}
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/20"
            >
              ログアウト
            </button>
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
