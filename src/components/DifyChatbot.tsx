'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

/**
 * Dify 智能体消费者角色守卫
 * 脚本和样式已在 layout.tsx 全局注入
 * 此组件仅用于在非消费者角色下隐藏 Dify 气泡
 */
export default function DifyChatbot() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const isCustomer = session?.user?.user_metadata?.role === 'customer'
      setVisible(isCustomer)
    })
  }, [])

  useEffect(() => {
    if (!visible) {
      // 非消费者角色：隐藏 Dify 气泡
      const hideDify = () => {
        const btn = document.getElementById('dify-chatbot-bubble-button')
        const win = document.getElementById('dify-chatbot-bubble-window')
        if (btn) btn.style.display = 'none'
        if (win) win.style.display = 'none'
      }
      // embed.min.js 可能还没渲染，轮询等它出现
      hideDify()
      const timer = setInterval(() => {
        const btn = document.getElementById('dify-chatbot-bubble-button')
        if (btn) {
          hideDify()
          clearInterval(timer)
        }
      }, 300)
      setTimeout(() => clearInterval(timer), 5000)
    }
  }, [visible])

  return null
}
