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
            }
            /* 隐藏右上角关闭叉号 */
            #closeIcon {
              display: none !important;
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

        {/* Dify 智能体嵌入 */}
        <script src="https://udify.app/embed.min.js" id="kXtniUYlZOuWJTKB"></script>

        {/* 遮罩 + 点击空白关闭聊天框 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var overlay = document.createElement('div');
                overlay.id = 'dify-overlay-close';
                overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:999998;display:none;';
                document.body.appendChild(overlay);

                overlay.addEventListener('click', function(e) {
                  if (e.target === overlay) {
                    var btn = document.getElementById('dify-chatbot-bubble-button');
                    if (btn) btn.click();
                    overlay.style.display = 'none';
                  }
                });

                // 监听到气泡窗口显示时，显示遮罩
                var observer = new MutationObserver(function() {
                  var win = document.getElementById('dify-chatbot-bubble-window');
                  if (win) {
                    overlay.style.display = win.style.display !== 'none' ? 'block' : 'none';
                  }
                });

                // 等 embed.min.js 渲染完成后再观察
                setTimeout(function() {
                  var win = document.getElementById('dify-chatbot-bubble-window');
                  if (win) {
                    observer.observe(win, { attributes: true, attributeFilter: ['style'] });
                  }
                }, 2000);
              })();
            `
          }}
        />
      </body>
    </html>
  );
}
