'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function DifyChatbot() {
  useEffect(() => {
    let mounted = true
    let cleanup: (() => void) | null = null

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      if (!session?.user) return
      const role = session.user.user_metadata?.role
      if (role !== 'customer') return

      // 注入 Dify 配置
      ;(window as any).difyChatbotConfig = {
        token: 'kXtniUYlZOuWJTKB',
        inputs: {},
        systemVariables: {},
        userVariables: {},
      }

      // 注入样式
      const style = document.createElement('style')
      style.id = 'dify-customer-style'
      style.textContent = `
        #dify-chatbot-bubble-button { background-color: #1C64F2 !important; }
        #dify-chatbot-bubble-window { width: 24rem !important; height: 40rem !important; }
      `
      document.head.appendChild(style)

      // 注入 embed 脚本
      const script = document.createElement('script')
      script.src = 'https://udify.app/embed.min.js'
      script.id = 'kXtniUYlZOuWJTKB'
      script.defer = true
      document.body.appendChild(script)

      cleanup = () => {
        script.remove()
        style.remove()
        document.getElementById('dify-chatbot-bubble-button')?.remove()
        document.getElementById('dify-chatbot-bubble-window')?.remove()
      }
    }

    setup()

    // 监听登录/登出
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        if (cleanup) cleanup()
        return
      }
      const role = session.user.user_metadata?.role
      if (role === 'customer') setup()
    })

    return () => {
      mounted = false
      if (cleanup) cleanup()
      subscription?.unsubscribe()
    }
  }, [])

  return null
}
