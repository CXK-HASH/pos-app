'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function DifyChatbot() {
  const doneRef = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      if (session.user.user_metadata?.role !== 'customer') return
      if (doneRef.current) return
      doneRef.current = true

      console.log('🤖 [DIFY] 注入 consumer Dify 智能体', session.user.id)

      // 1. 先设配置
      ;(window as any).difyChatbotConfig = {
        token: 'kXtniUYlZOuWJTKB',
        inputs: {},
        systemVariables: {},
        userVariables: {},
      }

      // 2. 再创建 script（不用 defer，不加 async）
      const script = document.createElement('script')
      script.src = 'https://udify.app/embed.min.js'
      script.id = 'kXtniUYlZOuWJTKB'
      document.body.appendChild(script)

      // 3. 样式注入（等待 embed.min.js 加载后再注入，防覆盖）
      const injectStyle = () => {
        const existing = document.getElementById('dify-custom-style')
        if (existing) existing.remove()
        const style = document.createElement('style')
        style.id = 'dify-custom-style'
        style.textContent = `
          #dify-chatbot-bubble-button {
            background-color: #1C64F2 !important;
            z-index: 999999 !important;
            bottom: 5rem !important;
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
              height: 75vh !important;
              bottom: 5rem !important;
              right: 1rem !important;
            }
            #dify-chatbot-bubble-button {
              bottom: 5rem !important;
              right: 1.5rem !important;
            }
          }
        `
        document.head.appendChild(style)
        console.log('🤖 [DIFY] 样式已注入')
      }

      // embed.min.js 加载完成后注入样式
      script.onload = injectStyle
      // 兜底：1.5 秒后如果还没加载完成也注入
      setTimeout(() => {
        if (!document.getElementById('dify-custom-style')) {
          injectStyle()
        }
      }, 1500)
    })
  }, [])

  return null
}
