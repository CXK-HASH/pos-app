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
            #closeIcon {
              display: none !important;
            }
            #dify-chatbot-bubble-button svg {
              width: 28px !important;
              height: 28px !important;
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

        <script src="https://udify.app/embed.min.js" id="kXtniUYlZOuWJTKB"></script>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // 替换气泡 SVG 为更精致的聊天气泡图标
                function upgradeIcon() {
                  var icon = document.getElementById('openIcon');
                  if (!icon) return;
                  // 清空原有路径
                  while (icon.firstChild) icon.removeChild(icon.firstChild);
                  icon.setAttribute('viewBox', '0 0 24 24');
                  icon.setAttribute('width', '28');
                  icon.setAttribute('height', '28');
                  icon.setAttribute('fill', 'none');
                  // 聊天气泡路径 — 圆角气泡+三条波浪线
                  var svgNS = 'http://www.w3.org/2000/svg';
                  var p1 = document.createElementNS(svgNS, 'path');
                  p1.setAttribute('fill-rule', 'evenodd');
                  p1.setAttribute('clip-rule', 'evenodd');
                  p1.setAttribute('d', 'M4 2C2.895 2 2 2.895 2 4v12c0 1.105.895 2 2 2h2v3a1 1 0 001.625.78L13.414 18H20c1.105 0 2-.895 2-2V4c0-1.105-.895-2-2-2H4zm2 4a1 1 0 011-1h10a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h3a1 1 0 110 2H7a1 1 0 01-1-1z');
                  p1.setAttribute('fill', 'white');
                  icon.appendChild(p1);
                }

                setTimeout(upgradeIcon, 2000);

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

                overlay.addEventListener('click', function(e) {
                  if (e.target === overlay) toggleBubble(false);
                });

                document.addEventListener('click', function(e) {
                  var btn = document.getElementById('dify-chatbot-bubble-button');
                  if (btn && (e.target === btn || btn.contains(e.target))) {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleBubble(true);
                  }
                });

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

                document.addEventListener('click', function(e) {
                  var win = document.getElementById('dify-chatbot-bubble-window');
                  if (win && win.style.display === 'none') {
                    var btn = document.getElementById('dify-chatbot-bubble-button');
                    if (btn) btn.style.display = '';
                    overlay.style.display = 'none';
                  }
                });

                setTimeout(function() {
                  var win = document.getElementById('dify-chatbot-bubble-window');
                  if (win) win.style.display = 'none';
                }, 2000);
              })();
            `
          }}
        />
      </body>
    </html>
  );
}
