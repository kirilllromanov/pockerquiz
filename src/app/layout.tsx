import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poker Quiz",
  description: "Онлайн-квиз с раундами ставок для ведущего и игроков.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
