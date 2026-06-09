'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function DietHealthWidget() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (!session?.user) return
      const role = session.user.user_metadata?.role
      if (role !== 'customer') return
      setVisible(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) { setVisible(false); return }
      const role = session.user.user_metadata?.role
      setVisible(role === 'customer')
    })

    return () => { mounted = false; subscription?.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!visible) return

    console.log('🍎 饮食健康智能体: 加载 widget.js')

    const script = document.createElement('script')
    script.src = 'https://dietary-health-agent.vercel.app/widget.js'
    script.setAttribute('data-server', 'https://dietary-health-agent.vercel.app')
    script.onload = () => console.log('🍎 饮食健康智能体加载成功')
    script.onerror = (e) => console.error('🍎 饮食健康智能体加载失败', e)
    document.body.appendChild(script)

    return () => {
      // 移除 widget 创建的 DOM
      document.querySelector('.dhw-floating-button')?.remove()
      document.querySelector('.dhw-chat-panel')?.remove()
      document.querySelector('.dhw-root')?.remove()
      script.remove()
    }
  }, [visible])

  return null
}
