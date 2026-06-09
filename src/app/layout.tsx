import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "坤坤闪购",
  description: "美味外卖，即刻送达",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const mapAk = process.env.NEXT_PUBLIC_BAIDU_MAP_AK || ''

  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50">
        {/* 百度地图 SDK — afterInteractive 异步加载，避免 document.write 冲突 */}
        {mapAk ? (
          <Script
            src={`https://api.map.baidu.com/api?v=3.0&ak=${mapAk}&callback=onBMapLoaded`}
            strategy="afterInteractive"
          />
        ) : (
          <Script
            id="bmap-fallback"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `console.warn('⚠️ [BMap] NEXT_PUBLIC_BAIDU_MAP_AK 未配置，地图功能不可用');`,
            }}
          />
        )}
        <Navbar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
