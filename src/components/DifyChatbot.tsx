'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function DifyChatbot() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      const role = session.user.user_metadata?.role
      if (role === 'customer') {
        setVisible(true)
      }
    })
  }, [])

  useEffect(() => {
    if (!visible) return

    // 注入 Dify 配置
    ;(window as any).difyChatbotConfig = {
      token: 'kXtniUYlZOuWJTKB',
      inputs: {},
      systemVariables: {},
      userVariables: {},
    }

    // 注入脚本
    const script = document.createElement('script')
    script.src = 'https://udify.app/embed.min.js'
    script.id = 'kXtniUYlZOuWJTKB'
    script.defer = true
    document.body.appendChild(script)

    // 注入样式
    const style = document.createElement('style')
    style.textContent = `
      #dify-chatbot-bubble-button { background-color: #1C64F2 !important; }
      #dify-chatbot-bubble-window { width: 24rem !important; height: 40rem !important; }
    `
    document.head.appendChild(style)

    return () => {
      script.remove()
      style.remove()
    }
  }, [visible])

  return null
}
