import Link from "next/link";

const features = [
  {
    title: "AI OCRで馬券管理を自動化",
    description:
      "紙の馬券を撮影してアップロードするだけで、AIが買い目や払戻金を読み取りデータベースに整理します。",
  },
  {
    title: "リアルタイムな収支分析",
    description:
      "購入額や回収率を自動集計し、競馬場・券種ごとの傾向をグラフで確認できます。",
  },
  {
    title: "チームで共有",
    description:
      "クラウド上のダッシュボードで仲間と戦略を共有。いつでもどこでも最新の情報にアクセス可能です。",
  },
];

const flowSteps = [
  {
    title: "馬券を撮影",
    description: "スマホで撮影した画像をそのままアップロードします。",
  },
  {
    title: "AIが自動解析",
    description: "OCRとLLMが買い目・払戻・メモを認識し、候補を提案します。",
  },
  {
    title: "ダッシュボードで分析",
    description: "蓄積されたデータをもとに回収率やトレンドを可視化します。",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-wide text-white">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">KM</span>
            Keiba OCR Manager
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-200 md:flex">
            <Link href="#features" className="transition hover:text-white">
              機能
            </Link>
            <Link href="#flow" className="transition hover:text-white">
              利用の流れ
            </Link>
            <Link href="#cta" className="transition hover:text-white">
              料金・導入
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden rounded-full border border-emerald-500/40 px-5 py-2 text-sm font-semibold text-emerald-300 transition hover:border-emerald-400 hover:text-emerald-200 md:inline-flex"
            >
              デモを見る
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-emerald-300"
            >
              無料で始める
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-6 py-16">
        <section id="hero" className="grid items-center gap-12 md:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-6">
            <p className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
              AI Powered OCR
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
              AI OCRで馬券管理を自動化し、収支改善のヒントを逃さない。
            </h1>
            <p className="text-lg text-slate-200">
              Keiba OCR Managerは、撮影した馬券を自動でデータ化し、収支とトレンドをリアルタイムに可視化するダッシュボードです。
              面倒な入力作業から解放され、分析と戦略立案に集中できます。
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="rounded-full bg-emerald-400 px-6 py-3 text-base font-semibold text-slate-950 shadow-xl transition hover:bg-emerald-300"
              >
                ダッシュボードを試す
              </Link>
              <Link
                href="#features"
                className="rounded-full border border-white/20 px-6 py-3 text-base font-semibold text-white transition hover:border-white/40"
              >
                機能を見る
              </Link>
            </div>
          </div>
          <div className="hidden h-full rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-950 p-8 shadow-2xl md:block">
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-200">Dashboard Highlights</h2>
                <p className="mt-2 text-sm text-slate-200">
                  自動集計された回収率、競馬場別傾向、買い目ヒートマップなど、分析に役立つ指標をひと目で確認。
                </p>
              </div>
              <ul className="space-y-4 text-sm text-slate-200">
                <li className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-200">1</span>
                  画像から買い目・オッズ・払戻を抽出
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-200">2</span>
                  買い目候補を確認してワンクリック登録
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-200">3</span>
                  リアルタイム更新のチャートで分析
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section id="features" className="space-y-12">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-bold text-white md:text-4xl">主な機能</h2>
            <p className="text-lg text-slate-200">
              AI OCRとデータ可視化の組み合わせで、これまでにないスピードで馬券管理を自動化します。
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-3xl border border-white/10 bg-white/5 p-8 text-left shadow-lg shadow-black/20"
              >
                <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-200">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="flow" className="space-y-12">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-bold text-white md:text-4xl">3ステップの利用フロー</h2>
            <p className="text-lg text-slate-200">
              アプリの利用はたったの3ステップ。初めての方でも迷わずデータ化まで進めます。
            </p>
          </div>
          <ol className="grid gap-6 md:grid-cols-3">
            {flowSteps.map((step, index) => (
              <li
                key={step.title}
                className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-8 text-left"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/20 text-xl font-semibold text-emerald-200">
                  {index + 1}
                </span>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-200">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="cta"
          className="rounded-3xl border border-emerald-400/20 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-slate-900 p-12 text-center shadow-2xl"
        >
          <div className="mx-auto max-w-2xl space-y-6">
            <h2 className="text-3xl font-bold text-white md:text-4xl">今すぐ自動化された馬券管理を体験</h2>
            <p className="text-lg text-slate-100">
              SupabaseとAI OCRを組み合わせたダッシュボードで、馬券管理の手間をゼロに。無料プランで今すぐ始められます。
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="rounded-full bg-white px-6 py-3 text-base font-semibold text-slate-950 shadow-xl transition hover:bg-slate-100"
              >
                無料アカウントを作成
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full border border-white/30 px-6 py-3 text-base font-semibold text-white transition hover:border-white/50"
              >
                ダッシュボードを見る
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-slate-950/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-center text-xs text-slate-400 md:flex-row md:text-left">
          <span>© {new Date().getFullYear()} Keiba OCR Manager. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="#features" className="hover:text-white">
              機能
            </Link>
            <Link href="#flow" className="hover:text-white">
              利用の流れ
            </Link>
            <Link href="/dashboard" className="hover:text-white">
              はじめる
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
