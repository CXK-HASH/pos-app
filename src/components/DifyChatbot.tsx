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

      // 1. 设置配置
      ;(window as any).difyChatbotConfig = {
        token: 'kXtniUYlZOuWJTKB',
        inputs: {},
        systemVariables: {},
        userVariables: {},
      }

      // 2. 添加样式（含移动端适配）
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

      // 3. 创建并追加 script
      const script = document.createElement('script')
      script.src = 'https://udify.app/embed.min.js'
      script.id = 'kXtniUYlZOuWJTKB'
      // 注意：这里不用 defer，让脚本立即执行
      document.body.appendChild(script)
    })
  }, [])

  return null
}
