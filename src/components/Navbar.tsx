'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 获取当前会话
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  const userLabel = user?.email
    ? user.email.length > 20
      ? user.email.slice(0, 18) + '...'
      : user.email
    : ''

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 text-lg">
          <span>🍽️</span>
          <span>小龙虾外卖</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/orders"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            我的订单
          </Link>

          {loading ? (
            <div className="w-20 h-8 bg-gray-100 rounded-xl animate-pulse"></div>
          ) : user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 hidden sm:inline">{userLabel}</span>
              <button
                onClick={handleSignOut}
                className="px-4 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
              >
                退出
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-5 py-1.5 text-sm font-medium bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:opacity-90 transition-all"
            >
              登录/注册
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
