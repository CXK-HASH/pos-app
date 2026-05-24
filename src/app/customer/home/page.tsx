'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type Merchant = {
  id: number
  name: string
  logo_url: string | null
  rating: number
}

const LOGO_EMOJIS: Record<string, string> = {
  '湘味木桶饭': '🍚',
  '蜜雪冰城': '🍦',
}

export default function CustomerHome() {
  const router = useRouter()
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 路由守卫：非消费者或未登录踢回首页
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/')
        return
      }
      const role = session.user.user_metadata?.role
      if (role !== 'customer') {
        alert('权限不足！')
        router.push('/')
        return
      }
    })
  }, [router])

  useEffect(() => {
    supabase
      .from('merchants')
      .select('*')
      .order('id', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setMerchants(data)
        setIsLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-800">🍽️ 外卖平台</h1>
          <p className="text-sm text-gray-400 mt-0.5">选择商家开始点餐</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="text-center py-20 text-gray-400">加载中...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {merchants.map(m => (
              <Link
                key={m.id}
                href={`/merchant/${m.id}`}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-orange-200 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-3xl shrink-0">
                    {LOGO_EMOJIS[m.name] || '🏪'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-gray-800 group-hover:text-orange-600 transition-colors">
                      {m.name}
                    </h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                      ⭐ {m.rating} 分
                    </p>
                  </div>
                  <span className="text-gray-300 group-hover:text-orange-400 transition-colors text-xl">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
