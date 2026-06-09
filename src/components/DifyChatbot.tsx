'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function DietHealthWidget() {
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (!session?.user) return
      const role = session.user.user_metadata?.role
      if (role !== 'customer') return

      // 注入 widget 脚本
      const script = document.createElement('script')
      script.src = 'https://dietary-health-agent.vercel.app/widget.js'
      script.setAttribute('data-server', 'https://dietary-health-agent.vercel.app')
      script.onload = () => {
        console.log('🍎 饮食健康智能体已加载')
      }
      document.body.appendChild(script)
    })

    return () => { mounted = false }
  }, [])

  return null
}
