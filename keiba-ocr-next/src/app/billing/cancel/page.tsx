import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RetryPremiumCheckoutButton } from "./RetryPremiumCheckoutButton";

export const metadata = {
  title: "決済をキャンセルしました",
  description: "Stripe 決済がキャンセルされました。再開するかダッシュボードへ戻ることができます。",
};

export default function BillingCancelPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-16">
      <Card className="max-w-lg text-center">
        <CardHeader>
          <CardTitle>決済をキャンセルしました</CardTitle>
          <CardDescription>
            Stripe の決済フローがキャンセルされました。必要に応じて再度お手続きください。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-200">
          <p>
            決済が完了していないため、プレミアム機能はまだ有効化されていません。決済をやり直すか、ダッシュボードに戻って引き続きサービスをご利用いただけます。
          </p>
          <p className="text-xs text-slate-400">
            すでに決済が完了している場合は、ページを更新するか少し時間をおいてから再度ご確認ください。
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <RetryPremiumCheckoutButton className="w-full sm:w-auto" />
          <Link
            href="/dashboard"
            className="inline-flex w-full items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:text-white sm:w-auto"
          >
            ダッシュボードへ戻る
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
