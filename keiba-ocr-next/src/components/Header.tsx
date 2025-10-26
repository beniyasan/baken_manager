"use client";

import type { User } from "@supabase/supabase-js";

export type HeaderProps = {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
};

export const Header = ({ user, onLogin, onLogout }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-30 border-b border-white/20 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="space-y-2">
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Keiba OCR Manager
          </span>
          <h1 className="text-2xl font-semibold text-slate-800">馬券管理ダッシュボード</h1>
          <p className="text-sm text-slate-500">
            アップロードした馬券の管理・統計をリアルタイムに可視化。OCRで自動入力も可能です。
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden flex-col text-right md:flex">
            <span className="text-xs uppercase tracking-wide text-slate-400">アカウント</span>
            <span className="text-sm font-medium text-slate-700">{user ? user.email : "未ログイン"}</span>
          </div>
          {user ? (
            <button
              onClick={onLogout}
              className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              ログアウト
            </button>
          ) : (
            <button
              onClick={onLogin}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white shadow-lg transition hover:bg-slate-700"
            >
              ログイン
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
