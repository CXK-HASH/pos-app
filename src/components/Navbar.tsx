'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setRole(session?.user?.user_metadata?.role ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setRole(session?.user?.user_metadata?.role ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  const userLabel = user?.email
    ? user.email.length > 22
      ? user.email.slice(0, 20) + '...'
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
            <div className="flex items-center gap-2">
              {role === 'merchant' && (
                <Link
                  href="/admin/dashboard"
                  className="px-3 py-1.5 text-sm bg-orange-50 text-orange-700 rounded-xl hover:bg-orange-100 transition-colors flex items-center gap-1"
                >
                  🏪 商家后台
                </Link>
              )}
              {role === 'driver' && (
                <Link
                  href="/driver/dashboard"
                  className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors flex items-center gap-1"
                >
                  🚴 骑手大厅
                </Link>
              )}
              <span className="text-sm text-gray-500 hidden sm:inline">{userLabel}</span>
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
