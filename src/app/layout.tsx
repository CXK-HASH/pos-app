import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

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
        {/* Dify 智能体：配置 + 样式 + 脚本，全量 HTML 标签嵌入 */}
        <style dangerouslySetInnerHTML={{
          __html: `
            #dify-chatbot-bubble-button {
              position: fixed !important;
              background-color: #1C64F2 !important;
              z-index: 999999 !important;
              bottom: 6rem !important;
              right: 1.5rem !important;
            }
            #dify-chatbot-bubble-window {
              position: fixed !important;
              z-index: 999999 !important;
              width: 24rem !important;
              height: 40rem !important;
            }
            @media (max-width: 768px) {
              #dify-chatbot-bubble-window {
                position: fixed !important;
                width: calc(100% - 2rem) !important;
                height: 75vh !important;
                bottom: 5.5rem !important;
                right: 1rem !important;
              }
            }
          `
        }} />
        <script
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
        {/* 百度地图 SDK（getscript 方式，无 document.write） */}
        {mapAk && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.BMAP_PROTOCOL = "https";
                window.BMap_loadScriptTime = new Date().getTime();
                var s = document.createElement('script');
                s.src = 'https://api.map.baidu.com/getscript?v=3.0&ak=${mapAk}&services=&t=20260511192400';
                document.body.appendChild(s);
              `
            }}
          />
        )}
        <Navbar />
        <main className="flex-1">{children}</main>

        {/* Dify 智能体：embed.min.js 尾部门户注入 */}
        <script src="https://udify.app/embed.min.js" id="kXtniUYlZOuWJTKB"></script>
      </body>
    </html>
  );
}
