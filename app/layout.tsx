import type { Metadata } from "next";
import localFont from "next/font/local";

import { AppShell } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";

import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "InsightFlow 用户回放平台 Demo",
  description: "基于 Next.js 14、Prisma 和 shadcn/ui 构建的用户回放平台 Demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={cn("font-sans", geistSans.variable)}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} theme antialiased`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
