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
      <head>
        {/* Dify 气泡按钮全局 CSS 提权 */}
        <style dangerouslySetInnerHTML={{
          __html: `
            #dify-chatbot-bubble-button {
              background-color: #1C64F2 !important;
              z-index: 999999 !important;
              bottom: 6rem !important;
              right: 1.5rem !important;
            }
            #dify-chatbot-bubble-window {
              z-index: 999999 !important;
            }
            @media (max-width: 768px) {
              #dify-chatbot-bubble-window {
                width: calc(100% - 2rem) !important;
                height: 75vh !important;
                bottom: 5.5rem !important;
                right: 1rem !important;
              }
            }
          `
        }} />

        {/* Dify 智能体核心配置 — 必须早于 embed.min.js */}
        <Script
          id="dify-independent-config"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.difyChatbotConfig = {
                token: 'kXtniUYlZOuWJTKB',
                inputs: {},
                systemVariables: {},
                userVariables: {}
              };
            `
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-gray-50">
        {/* 百度地图 SDK — 直接加载 getscript 核心，避免 document.write 清空文档 */}
        {mapAk ? (
          <>
            <Script
              id="bmap-loader"
              strategy="beforeInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.BMAP_PROTOCOL = "https";
                  window.BMap_loadScriptTime = new Date().getTime();
                `
              }}
            />
            <Script
              id="bmap-core"
              src={`https://api.map.baidu.com/getscript?v=3.0&ak=${mapAk}&services=&t=20260511192400`}
              strategy="beforeInteractive"
            />
          </>
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

        {/* Dify 智能体嵌入引擎包 */}
        <Script
          id="dify-independent-engine"
          src="https://udify.app/embed.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
