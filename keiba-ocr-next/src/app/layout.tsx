import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Keiba OCR Manager",
  description: "Horse racing ticket management dashboard powered by Supabase and Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased bg-slate-950/60 text-slate-950">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),rgba(230,244,255,0.6))]">
          {children}
        </div>
      </body>
    </html>
  );
}
