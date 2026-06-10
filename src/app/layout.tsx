import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Script from "next/script";
import DifyChatbot from "@/components/DifyChatbot";

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
        {/* Dify 气泡全局最高层级提权样式 */}
        <style dangerouslySetInnerHTML={{
          __html: `
            #dify-chatbot-bubble-button {
              background-color: #1C64F2 !important;
              z-index: 999999 !important;
              bottom: 6rem !important;
              right: 1.5rem !important;
            }
            #dify-chatbot-bubble-window {
              width: 24rem !important;
              height: 40rem !important;
              z-index: 999999 !important;
            }
            @media (max-width: 768px) {
              #dify-chatbot-bubble-window {
                width: calc(100% - 2rem) !important;
                height: 70vh !important;
                bottom: 5.5rem !important;
                right: 1rem !important;
              }
            }
          `
        }} />
      </head>
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

        {/* 增量补回 1：Dify 智能体核心运行时基础上下文 */}
        <Script
          id="dify-chatbot-config-bind"
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

        {/* 增量补回 2：Dify 官方嵌入引擎包 */}
        <Script
          id="kXtniUYlZOuWJTKB"
          src="https://udify.app/embed.min.js"
          strategy="lazyOnload"
        />

        {/* 消费者角色条件渲染（仅作控制显示，不重复注入脚本） */}
        <DifyChatbot />
      </body>
    </html>
  );
}
