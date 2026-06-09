'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function DifyChatbot() {
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      const role = session.user.user_metadata?.role
      setVisible(role === 'customer')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) { setVisible(false); setOpen(false); return }
      const role = session.user.user_metadata?.role
      setVisible(role === 'customer')
    })

    return () => { subscription?.unsubscribe() }
  }, [])

  if (!visible) return null

  return (
    <>
      {/* 气泡按钮 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#1C64F2] text-white text-2xl shadow-lg hover:scale-110 transition-all flex items-center justify-center cursor-pointer"
        >
          💬
        </button>
      )}

      {/* 聊天窗口 */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[40rem] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#1C64F2] text-white">
            <span className="font-bold text-sm">坤坤闪购 AI 助手</span>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-sm hover:bg-white/30 cursor-pointer"
            >
              ✕
            </button>
          </div>
          {/* iframe 窗口 */}
          <iframe
            src="https://udify.app/chatbot/kXtniUYlZOuWJTKB"
            className="flex-1 w-full border-0"
            title="AI 助手"
          />
        </div>
      )}
    </>
  )
}
