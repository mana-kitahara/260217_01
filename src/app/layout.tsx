import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Soft Study Notes",
  description: "手書き・表編集対応の学習向けWebノート",
  applicationName: "Soft Study Notes",
};

export const viewport: Viewport = {
  themeColor: "#f5e2f2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
