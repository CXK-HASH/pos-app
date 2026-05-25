'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Dish = {
  id: number
  name: string
  price: number
  image_url: string | null
  merchant_id: number
  dish_category_id: number | null
}

type DishCategory = {
  id: number
  name: string
}

type Merchant = {
  id: number
  name: string
  logo_url: string | null
  rating: number
}

const CARD_EMOJI = ['🍱', '🥩', '🍗', '🥘', '🍜', '🍛', '🫘', '🥟', '🧋', '🥤', '🧃']

export default function MerchantPage() {
  const params = useParams()
  const router = useRouter()
  const merchantId = Number(params.id)

  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [dishes, setDishes] = useState<Dish[]>([])
  const [categories, setCategories] = useState<DishCategory[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [cart, setCart] = useState<Record<number, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCartMobile, setShowCartMobile] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<string | null>(null)

  // 获取商家信息和菜品分类列表
  useEffect(() => {
    Promise.all([
      fetch('/api/merchants').then(r => r.json()),
      fetch('/api/dish-categories').then(r => r.json()),
    ]).then(([merchants, cats]) => {
      const m = merchants.find((m: Merchant) => m.id === merchantId)
      setMerchant(m || null)
      setCategories(cats)
    })
  }, [merchantId])

  const loadDishes = useCallback(async (categoryId: number | null) => {
    const params = new URLSearchParams()
    params.set('merchant_id', String(merchantId))
    if (categoryId !== null) {
      params.set('dish_category_id', String(categoryId))
    }
    const res = await fetch(`/api/dishes?${params}`)
    const data = await res.json()
    setDishes(data)
    setIsLoading(false)
  }, [merchantId])

  useEffect(() => {
    setIsLoading(true)
    loadDishes(selectedCategoryId)
  }, [selectedCategoryId, loadDishes])

  const addToCart = useCallback((dishId: number) => {
    setCart(prev => ({ ...prev, [dishId]: (prev[dishId] || 0) + 1 }))
    setShowCartMobile(true)
  }, [])

  const removeFromCart = useCallback((dishId: number) => {
    setCart(prev => {
      const next = { ...prev }
      if (next[dishId] <= 1) delete next[dishId]
      else next[dishId]--
      return next
    })
  }, [])

  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const dish = dishes.find(d => d.id === Number(id))
    return sum + (dish ? dish.price * qty : 0)
  }, 0)

  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0)

  const handleCheckout = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }

    const userRole = session.user.user_metadata?.role
    if (userRole === 'merchant') {
      alert('您的身份是商家，无法进行前台下单')
      return
    }

    setIsSubmitting(true)
    try {
      const items = Object.entries(cart).map(([dishId, quantity]) => {
        const dish = dishes.find(d => d.id === Number(dishId))
        return { name: dish!.name, price: dish!.price, quantity }
      })

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ merchantId, items }),
      })

      const data = await res.json()
      if (data.success) {
        setCart({})
        setShowCartMobile(false)
        router.push('/orders')
      } else {
        alert(data.error || '下单失败')
      }
    } catch {
      alert('网络异常')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAiOrder = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiResult(null)
    try {
      const res = await fetch('/api/ai-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, merchantId, categories, dishes }),
      })
      const data = await res.json()
      setAiResult(data.reply || '没能理解您的点餐需求，请重新描述')
    } catch {
      setAiResult('网络异常，请重试')
    } finally {
      setAiLoading(false)
    }
  }

  const filteredDishes = selectedCategoryId
    ? dishes.filter(d => d.dish_category_id === selectedCategoryId)
    : dishes

  return (
    <div className="min-h-screen bg-[#0B0F19] pb-24">
      <style jsx global>{`
        .cart-breathe {
          animation: breathe 2s ease-in-out infinite;
        }
        @keyframes breathe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>

      {/* 商家头部 */}
      {merchant && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="flex items-center gap-4 mb-3">
              <Link href="/customer/home" className="text-white/70 hover:text-white transition-colors text-lg">
                ← 返回
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-4xl shadow-lg">
                {merchant.logo_url ? (
                  <img src={merchant.logo_url} alt={merchant.name} className="w-full h-full rounded-2xl object-cover" />
                ) : (
                  '🍽️'
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{merchant.name}</h1>
                <div className="flex items-center gap-3 mt-1.5 text-white/70 text-sm">
                  <span className="flex items-center gap-1">⭐ {merchant.rating}</span>
                  <span>月售 999+</span>
                  <span>约 30 分钟</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-white/10 backdrop-blur-sm text-[10px] rounded-full">满 30 减 5</span>
                  <span className="px-2 py-0.5 bg-white/10 backdrop-blur-sm text-[10px] rounded-full">新客立减</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI 点餐区 */}
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🤖</span>
            <span className="text-sm font-bold text-slate-100">DeepSeek 智能点餐</span>
            <span className="text-[10px] bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-0.5 rounded-full">AI</span>
          </div>
          <div className="flex gap-2">
            <input
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAiOrder()}
              placeholder="告诉我你想吃什么，比如「一杯珍珠奶茶加一份鸡排饭」"
              className="flex-1 px-4 py-2.5 bg-slate-800/50 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-orange-300 transition-all"
            />
            <button
              onClick={handleAiOrder}
              disabled={aiLoading}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-medium rounded-xl hover:shadow-md disabled:opacity-50 transition-all active:scale-95"
            >
              {aiLoading ? '...' : 'AI 点餐'}
            </button>
          </div>
          {aiResult && (
            <div className="mt-3 p-3 bg-orange-500/10 rounded-xl text-sm text-slate-200 border border-orange-500/20 leading-relaxed">
              {aiResult.split('\n').map((line, i) => <p key={i}>{line}</p>)}
            </div>
          )}
        </div>

        {/* 分类胶囊 */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 ${
              selectedCategoryId === null
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            全部
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 ${
                selectedCategoryId === cat.id
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* 菜品列表 */}
        <div className="mt-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-orange-500 border-t-transparent"></div>
              <span className="ml-3 text-slate-500 text-sm">加载菜单中...</span>
            </div>
          ) : filteredDishes.length === 0 ? (
            <div className="text-center py-20 text-slate-500 text-sm">😅 这个分类还没有菜品，看看别的吧</div>
          ) : (
            filteredDishes.map((dish, idx) => (
              <div
                key={dish.id}
                className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(255,122,0,0.06)] transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-3xl shrink-0 ring-1 ring-slate-100">
                    {CARD_EMOJI[idx % CARD_EMOJI.length]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800">{dish.name}</h3>
                    <p className="text-slate-500 text-xs mt-0.5">精选食材，匠心制作</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-orange-500 font-bold text-lg">
                        ¥<span className="text-xl">{dish.price.toFixed(1).replace('.0', '')}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        {cart[dish.id] > 0 && (
                          <>
                            <button
                              onClick={() => removeFromCart(dish.id)}
                              className="w-7 h-7 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-700 transition-all active:scale-90"
                            >
                              <span className="text-lg leading-none">−</span>
                            </button>
                            <span className="text-sm font-semibold text-slate-200 min-w-[1.2rem] text-center">
                              {cart[dish.id]}
                            </span>
                          </>
                        )}
                        <button
                          onClick={() => addToCart(dish.id)}
                          className="w-8 h-8 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all"
                        >
                          <span className="text-lg leading-none">+</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 悬浮底部购物车 */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-3rem)] max-w-lg">
          <div className="bg-slate-900/90 backdrop-blur-md rounded-full p-3 shadow-xl flex items-center gap-3">
            <div className="relative ml-1">
              <button
                onClick={() => setShowCartMobile(!showCartMobile)}
                className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg cart-breathe"
              >
                🛒
              </button>
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
                {cartCount}
              </span>
            </div>
            <div className="flex-1">
              <button
                onClick={() => setShowCartMobile(!showCartMobile)}
                className="text-white font-bold text-base"
              >
                ¥{cartTotal.toFixed(1)}
              </button>
              <p className="text-white/50 text-[10px]">另需配送费 ¥3</p>
            </div>
            <button
              onClick={handleCheckout}
              disabled={isSubmitting || cartCount === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-bold rounded-full shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? '提交中...' : `去结算 · ${cartCount}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
