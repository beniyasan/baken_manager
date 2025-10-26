"use client";

import { PropsWithChildren, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

export function AuthGuard({ children }: PropsWithChildren) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        if (isMounted) {
          setUser(data.session?.user ?? null);
        }
      } catch (error) {
        console.error("AuthGuard セッション取得エラー", error);
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    init();

    const { data: subscription } = supabaseClient.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">ログインが必要です</h2>
        <p className="max-w-md text-sm text-slate-600">
          ログインすると馬券データの管理・統計機能をご利用いただけます。上部メニューからログインしてください。
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
