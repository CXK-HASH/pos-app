'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function DifyChatbot() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // 查当前 session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      const role = session.user.user_metadata?.role
      if (role === 'customer') setVisible(true)
    })

    // 监听登录/登出
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setVisible(false)
        return
      }
      const role = session.user.user_metadata?.role
      setVisible(role === 'customer')
    })

    return () => { subscription?.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!visible) {
      // 隐藏时移除 Dify DOM 残留
      document.getElementById('dify-chatbot-bubble-button')?.remove()
      document.getElementById('dify-chatbot-bubble-window')?.remove()
      document.querySelector('link[href*="dify"]')?.remove()
      return
    }

    // 注入 Dify 配置
    ;(window as any).difyChatbotConfig = {
      token: 'kXtniUYlZOuWJTKB',
      inputs: {},
      systemVariables: {},
      userVariables: {},
    }

    // 注入样式
    const styleId = 'dify-chatbot-style'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        #dify-chatbot-bubble-button { background-color: #1C64F2 !important; }
        #dify-chatbot-bubble-window { width: 24rem !important; height: 40rem !important; }
      `
      document.head.appendChild(style)
    }

    // 注入脚本（防止重复注入）
    const existingScript = document.getElementById('kXtniUYlZOuWJTKB')
    if (!existingScript) {
      const script = document.createElement('script')
      script.src = 'https://udify.app/embed.min.js'
      script.id = 'kXtniUYlZOuWJTKB'
      script.defer = true
      document.body.appendChild(script)
    }
  }, [visible])

  return null
}
