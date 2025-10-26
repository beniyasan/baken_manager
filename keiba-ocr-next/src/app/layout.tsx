import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950/60 text-slate-950`}
      >
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),rgba(230,244,255,0.6))]">
          {children}
        </div>
      </body>
    </html>
  );
}
