'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

/**
 * Dify 智能体注入容器
 * 仅在消费者角色下注入 embed.min.js
 * 使用 script 标签方式（用户要求的 exact 方式）
 */
export default function DifyChatbot() {
  const [isCustomer, setIsCustomer] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.user_metadata?.role === 'customer') {
        setIsCustomer(true)
      }
    })
  }, [])

  if (!isCustomer) return null

  return (
    <>
      {/* 全局样式提权 */}
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
              height: 70vh !important;
              bottom: 5.5rem !important;
              right: 1rem !important;
            }
          }
        `
      }} />

      {/* 配置注入 */}
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

      {/* 核心脚本 — 不用 defer */}
      <script
        src="https://udify.app/embed.min.js"
        id="kXtniUYlZOuWJTKB"
      />
    </>
  )
}
