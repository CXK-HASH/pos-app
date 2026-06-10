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
              background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24' fill='none'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M4 2C2.895 2 2 2.895 2 4v12c0 1.105.895 2 2 2h2v3a1 1 0 001.625.78L13.414 18H20c1.105 0 2-.895 2-2V4c0-1.105-.895-2-2-2H4zm2 4a1 1 0 011-1h10a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h3a1 1 0 110 2H7a1 1 0 01-1-1z' fill='white'/%3E%3C/svg%3E") !important;
              background-repeat: no-repeat !important;
              background-position: center !important;
              background-size: 28px !important;
              z-index: 999999 !important;
              bottom: 6rem !important;
              right: 1.5rem !important;
            }
            #dify-chatbot-bubble-button svg,
            #dify-chatbot-bubble-button #openIcon,
            #dify-chatbot-bubble-button #closeIcon {
              display: none !important;
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
                // 方式：不让按钮内容变动，用 MutationObserver 监控窗口状态
                var overlay = document.createElement('div');
                overlay.id = 'dify-overlay-close';
                overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:999998;display:none;background:transparent;';
                document.body.appendChild(overlay);

                overlay.addEventListener('click', function(e) {
                  if (e.target === overlay) {
                    var btn = document.getElementById('dify-chatbot-bubble-button');
                    if (btn) btn.click();
                    overlay.style.display = 'none';
                  }
                });

                // 监控气泡窗口的显示状态，同步按钮显示/隐藏
                function watchBubble() {
                  var win = document.getElementById('dify-chatbot-bubble-window');
                  var btn = document.getElementById('dify-chatbot-bubble-button');
                  if (!win || !btn) { setTimeout(watchBubble, 500); return; }

                  var observer = new MutationObserver(function() {
                    if (win.style.display !== 'none' && win.style.visibility !== 'hidden' && win.style.opacity !== '0') {
                      btn.style.display = 'none';
                      overlay.style.display = 'block';
                    } else {
                      btn.style.display = '';
                      overlay.style.display = 'none';
                    }
                  });
                  observer.observe(win, { attributes: true, attributeFilter: ['style', 'class'] });

                  // 初始检查
                  if (win.style.display !== 'none') {
                    btn.style.display = 'none';
                    overlay.style.display = 'block';
                  }
                }
                setTimeout(watchBubble, 2000);
              })();
            `
          }}
        />
      </body>
    </html>
  );
}
