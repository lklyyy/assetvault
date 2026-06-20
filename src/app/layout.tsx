import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AssetVault — AI 资产管理",
  description: "管理你的 AI 生成图片、文字和提示词，分类整理，团队共享",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
