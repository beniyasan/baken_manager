import Link from "next/link";
import type { Metadata } from "next";

import { BillingPortalButton } from "@/components/BillingPortalButton";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "プレミアムプランへアップグレード完了",
  description: "Keiba OCR Managerのプレミアム機能がご利用いただけるようになりました。",
};

export default function BillingSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-white">
      <Card className="w-full max-w-2xl border-emerald-500/20 bg-slate-900/80 shadow-emerald-500/20">
        <CardHeader>
          <CardTitle className="text-2xl">アップグレードありがとうございます！</CardTitle>
          <CardDescription>
            プレミアムプランへのアップグレードが完了しました。すべてのプレミアム機能がただちにご利用いただけます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed text-slate-200">
          <p>ダッシュボードで無制限のOCR解析や高度な分析ツールをご活用いただき、レース戦略の強化にお役立てください。</p>
          <p>請求情報の確認や支払い方法の更新は、いつでもカスタマーポータルから管理できます。</p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-6 py-2 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-emerald-300"
          >
            ダッシュボードへ進む
          </Link>
          <BillingPortalButton className="sm:w-auto" />
        </CardFooter>
      </Card>
    </div>
  );
}
