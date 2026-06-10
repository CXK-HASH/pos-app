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
        {/* 强制注入最高权重的 CSS 空间提权 */}
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
      </head>
      <body className="min-h-full flex flex-col bg-gray-50">
        {/* 百度地图 SDK — afterInteractive 异步加载 */}
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

        {/* 纯净增量隔离点一：注入全局常驻的 window 基础配置环境 */}
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

        {/* 纯净增量隔离点二：强制拉回原生的右下角气泡渲染引擎 */}
        <Script
          id="dify-independent-engine"
          src="https://udify.app/embed.min.js"
          strategy="lazyOnload"
        />

        {/* onLoad 回调用独立的 script 写，绕过 Next.js Script onLoad 的 SSR 限制 */}
        <Script
          id="dify-independent-callback"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `
              setTimeout(function() {
                var btn = document.getElementById('dify-chatbot-bubble-button');
                if (btn) {
                  console.log("🤖 [DIFY_BUBBLE_INDEPENDENT] 独立全局气泡已经成功强行接入，右下角安全亮起！");
                }
              }, 2000);
            `
          }}
        />
      </body>
    </html>
  );
}
