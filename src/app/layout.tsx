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

                function toggleBubble(show) {
                  var btn = document.getElementById('dify-chatbot-bubble-button');
                  var win = document.getElementById('dify-chatbot-bubble-window');
                  if (show) {
                    if (btn) btn.style.display = 'none';
                    if (win) win.style.display = '';
                    overlay.style.display = 'block';
                  } else {
                    if (btn) btn.style.display = '';
                    if (win) win.style.display = 'none';
                    overlay.style.display = 'none';
                  }
                }

                // 点击遮罩关闭
                overlay.addEventListener('click', function(e) {
                  if (e.target === overlay) {
                    toggleBubble(false);
                  }
                });

                // 点击气泡按钮：开
                document.addEventListener('click', function(e) {
                  var btn = document.getElementById('dify-chatbot-bubble-button');
                  if (btn && (e.target === btn || btn.contains(e.target))) {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleBubble(true);
                  }
                });

                // 监听气泡按钮点击（兼顾原生 toggle）
                document.addEventListener('click', function(e) {
                  var btn = document.getElementById('dify-chatbot-bubble-button');
                  if (btn && (e.target === btn || btn.contains(e.target))) {
                    setTimeout(function() {
                      var win = document.getElementById('dify-chatbot-bubble-window');
                      if (win && win.style.display !== 'none') {
                        btn.style.display = 'none';
                        overlay.style.display = 'block';
                      }
                    }, 100);
                  }
                });

                // 监听叉号点击（虽然在 CSS 中隐藏，但原生 Dify 可能有键盘关闭）
                document.addEventListener('click', function(e) {
                  var win = document.getElementById('dify-chatbot-bubble-window');
                  if (win && win.style.display === 'none') {
                    var btn = document.getElementById('dify-chatbot-bubble-button');
                    if (btn) btn.style.display = '';
                    overlay.style.display = 'none';
                  }
                });

                // 等 embed.min.js 渲染完成
                setTimeout(function() {
                  var win = document.getElementById('dify-chatbot-bubble-window');
                  if (win) {
                    // 初始状态：隐藏窗口
                    win.style.display = 'none';
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
