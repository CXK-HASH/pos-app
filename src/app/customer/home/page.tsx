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

const CATEGORIES = [
  { icon: '🍔', name: '汉堡', color: 'from-red-400 to-rose-500' },
  { icon: '🍜', name: '面食', color: 'from-amber-400 to-orange-500' },
  { icon: '🍲', name: '米饭', color: 'from-emerald-400 to-teal-500' },
  { icon: '☕', name: '奶茶', color: 'from-pink-400 to-purple-500' },
  { icon: '🥟', name: '饺子', color: 'from-sky-400 to-blue-500' },
  { icon: '🥗', name: '轻食', color: 'from-lime-400 to-green-500' },
]

const LOGO_EMOJIS: Record<string, string> = {
  '湘味木桶饭': '🍚',
  '蜜雪冰城': '🍦',
}

export default function CustomerHome() {
  const router = useRouter()
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<number | null>(null)

  // 路由守卫
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        alert('登录已失效，请重新登录！')
        localStorage.clear()
        sessionStorage.clear()
        window.location.href = '/'
        return
      }
      const role = session.user.user_metadata?.role
      if (role !== 'customer') {
        alert('权限不足！')
        localStorage.clear()
        sessionStorage.clear()
        window.location.href = '/'
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
    <div className="min-h-screen bg-slate-50">
      {/* 搜索与定位区 */}
      <div className="sticky top-14 z-40 bg-white/60 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-orange-500 text-lg">📍</span>
            <span className="font-bold text-slate-800 text-sm">天河城</span>
            <span className="text-slate-300 text-xs">▼</span>
          </div>
          <div className="flex-1 flex">
            <div className="flex-1 flex items-center bg-slate-100 rounded-full px-4 py-2">
              <span className="text-slate-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="搜索美食、商家..."
                className="ml-2 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none w-full"
              />
            </div>
            <button className="ml-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-medium rounded-full shadow-sm hover:shadow-md transition-all active:scale-95">
              搜索
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
        {/* Banner 广告位 */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 rounded-2xl shadow-md p-6 text-white relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-xl"></div>
          <div className="relative z-10">
            <p className="text-3xl mb-1">✨</p>
            <h2 className="text-lg font-bold">DeepSeek 智能食神</h2>
            <p className="text-sm text-orange-100 mt-1 opacity-90">懂你所爱 · AI 推荐专属美食</p>
            <button className="mt-3 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium hover:bg-white/30 transition-all">
              立即体验 →
            </button>
          </div>
        </div>

        {/* 金刚区分类 */}
        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-3">🍽️ 吃什么</h3>
          <div className="grid grid-cols-6 gap-3">
            {CATEGORIES.map((cat, i) => (
              <button
                key={i}
                onClick={() => setActiveCategory(activeCategory === i ? null : i)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-300
                  hover:-translate-y-1 hover:scale-105 hover:shadow-sm
                  ${activeCategory === i
                    ? 'bg-gradient-to-br ' + cat.color + ' text-white shadow-md'
                    : 'bg-white text-slate-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
                  }`}
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-xs font-medium">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 商家推荐 */}
        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-3">
            🔥 推荐商家
            <span className="text-slate-400 text-xs font-normal ml-2">附近热门外卖</span>
          </h3>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-orange-500 border-t-transparent"></div>
              <span className="ml-3 text-slate-400 text-sm">加载中...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {merchants.map(m => (
                <Link
                  key={m.id}
                  href={`/merchant/${m.id}`}
                  className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(255,122,0,0.1)] hover:-translate-y-1 transition-all duration-300 group overflow-hidden"
                >
                  {/* 顶部渐变装饰条 */}
                  <div className="h-2 bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500"></div>
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center text-3xl shrink-0 ring-1 ring-orange-100">
                        {LOGO_EMOJIS[m.name] || '🏪'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-slate-800 group-hover:text-orange-600 transition-colors">
                          {m.name}
                        </h2>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex items-center">
                            {[1,2,3,4,5].map(s => (
                              <span key={s} className={`text-xs ${s <= Math.round(m.rating) ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
                            ))}
                          </div>
                          <span className="text-amber-500 text-sm font-semibold">{m.rating}</span>
                          <span className="text-slate-300 mx-1">·</span>
                          <span className="text-slate-400 text-xs">月售 999+</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-medium rounded-full">满减</span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-medium rounded-full">优惠</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-xs text-slate-400">⏱ 约 30 分钟</span>
                      <span className="text-xs text-slate-400">🚚 配送费 ¥3</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
