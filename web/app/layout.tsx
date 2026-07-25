import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "SUS Ranking — Startup School 2026",
  description:
    "Head-to-head votes and an Elo leaderboard for Startup School 2026 attendees.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="arena-glow min-h-screen antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
