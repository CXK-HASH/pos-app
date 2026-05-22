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

  const handleCategoryClick = (categoryId: number) => {
    setSelectedCategoryId(prev => prev === categoryId ? null : categoryId)
  }

  const addToCart = useCallback((dishId: number) => {
    setCart(prev => ({ ...prev, [dishId]: (prev[dishId] || 0) + 1 }))
  }, [])

  const removeFromCart = useCallback((dishId: number) => {
    setCart(prev => {
      const next = { ...prev }
      const qty = next[dishId]
      if (qty <= 1) delete next[dishId]
      else next[dishId] = qty - 1
      return next
    })
  }, [])

  const cartCount = Object.values(cart).reduce((sum, q) => sum + q, 0)
  const totalPrice = Object.entries(cart).reduce((sum, [id, qty]) => {
    const dish = dishes.find(d => d.id === Number(id))
    return sum + (dish ? dish.price * qty : 0)
  }, 0)

  const handleCheckout = async () => {
    // 登录拦截
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      alert('请先登录后再下单！')
      setTimeout(() => router.push('/login'), 1500)
      return
    }

    // 商家身份无法下单
    const role = session.user?.user_metadata?.role
    if (role === 'merchant') {
      alert('您的身份是商家，无法进行前台下单，请更换消费者账号！')
      return
    }

    const items = Object.entries(cart).map(([id, qty]) => {
      const dish = dishes.find(d => d.id === Number(id))
      return { id: Number(id), name: dish?.name, price: dish?.price, quantity: qty }
    })

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({ cart: items, totalPrice, merchantId }),
      })
      const data = await res.json()
      if (data.success) {
        setCart({})
        setShowCartMobile(false)
        alert('✅ 下单成功！')
      } else {
        alert('❌ 下单失败: ' + (data.error || '未知错误'))
      }
    } catch {
      alert('❌ 网络错误，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!merchant && !isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">商家不存在</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ========== 顶部商家招牌 ========== */}
      <div className="relative h-44 bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-300 overflow-hidden">
        <div className="absolute inset-0 bg-white/20 backdrop-blur-sm"></div>
        <div className="relative h-full max-w-6xl mx-auto px-6 flex items-end pb-6 gap-4">
          <div className="flex-shrink-0 w-20 h-20 rounded-xl bg-white shadow-md flex items-center justify-center text-3xl">
            🏪
          </div>
          <div className="pb-0.5">
            <Link href="/" className="text-white/80 hover:text-white text-sm transition-colors block mb-0.5">← 返回首页</Link>
            <h1 className="text-2xl font-bold text-gray-900">{merchant?.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-yellow-600">★ {merchant?.rating || '-'}</span>
              <span className="text-xs text-gray-500/70">| 月售 486 单</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========== 主内容区：双栏布局 ========== */}
      <div className="max-w-6xl mx-auto px-6 py-6 flex gap-6">
        {/* ===== 左侧：AI 智能点餐 + 分类导航（22%） ===== */}
        <div className="hidden md:block w-[22%] flex-shrink-0 space-y-3">
          {/* AI 智能点餐卡片 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-base">🤖</span>
              <span className="text-sm font-bold text-gray-800">AI 智能点餐</span>
            </div>
            <div className="flex items-center gap-2 w-full">
              <input
                type="text"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') document.getElementById('ai-btn')?.click() }}
                placeholder="想吃点什么？大白话告诉 DeepSeek..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:bg-white transition-all min-w-0"
              />
              <button
                id="ai-btn"
                onClick={async () => {
                  if (!aiPrompt.trim() || aiLoading) return
                  setAiLoading(true)
                  setAiResult(null)
                  try {
                    const res = await fetch('/api/ai-classify', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text: aiPrompt.trim() }),
                    })
                    const data = await res.json()
                    if (data.tags && data.tags.length > 0) {
                      const matched = categories.find(c => data.tags.includes(c.name))
                      if (matched) setSelectedCategoryId(matched.id)
                      setAiResult(data.analysis || `为您找到了【${data.tags.join('、')}】相关菜品`)
                    } else {
                      setAiResult(null)
                      alert('🤖 AI 暂时无法分析，请手动选择分类')
                    }
                  } catch {
                    alert('🤖 网络异常，请稍后重试')
                  } finally {
                    setAiLoading(false)
                  }
                }}
                disabled={aiLoading}
                className="flex-shrink-0 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm hover:opacity-90 active:scale-95 transition-all whitespace-nowrap"
              >
                {aiLoading ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>分析中</span>
                  </span>
                ) : '智能分析'}
              </button>
            </div>
            {aiResult && (
              <div className="flex items-center justify-between mt-2.5 px-1">
                <p className="text-xs text-orange-600">🤖 {aiResult}</p>
                <button
                  onClick={() => { setAiResult(null); setAiPrompt(''); setSelectedCategoryId(null) }}
                  className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap shrink-0 ml-2"
                >
                  重置
                </button>
              </div>
            )}
          </div>

          {/* 分类导航（胶囊卡片） */}
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 sticky top-6">
            <p className="text-xs font-semibold text-gray-400 px-3 py-2.5 uppercase tracking-wider">全部分类</p>
            <div className="space-y-1.5">
              {categories.map(cat => {
                const isActive = selectedCategoryId === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${
                      isActive
                        ? 'bg-orange-50 text-orange-600 font-bold shadow-sm border border-orange-100'
                        : 'bg-transparent text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{cat.name}</span>
                    {isActive && <span className="text-orange-400 text-lg leading-none">›</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ===== 右侧：菜品流（80%） ===== */}
        <div className="flex-1 min-w-0">
          {/* 移动端：AI 智能点餐 */}
          <div className="md:hidden mb-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') document.getElementById('ai-btn-mobile')?.click() }}
                placeholder="AI 帮点，说句话试试..."
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all"
              />
              <button
                id="ai-btn-mobile"
                onClick={async () => {
                  if (!aiPrompt.trim() || aiLoading) return
                  setAiLoading(true)
                  setAiResult(null)
                  try {
                    const res = await fetch('/api/ai-classify', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text: aiPrompt.trim() }),
                    })
                    const data = await res.json()
                    if (data.tags && data.tags.length > 0) {
                      const matched = categories.find(c => data.tags.includes(c.name))
                      if (matched) setSelectedCategoryId(matched.id)
                      setAiResult(data.analysis || `为您找到了【${data.tags.join('、')}】相关菜品`)
                    } else {
                      setAiResult(null)
                      alert('🤖 AI 暂时无法分析，请手动选择分类')
                    }
                  } catch {
                    alert('🤖 网络异常，请稍后重试')
                  } finally {
                    setAiLoading(false)
                  }
                }}
                disabled={aiLoading}
                className="shrink-0 px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-all"
              >
                {aiLoading ? (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  </span>
                ) : 'AI'}
              </button>
            </div>
            {aiResult && (
              <div className="flex items-center justify-between mt-2 px-1">
                <p className="text-xs text-orange-600">🤖 {aiResult}</p>
                <button onClick={() => { setAiResult(null); setAiPrompt(''); setSelectedCategoryId(null) }} className="text-xs text-gray-400 hover:text-gray-600 shrink-0 ml-2">重置</button>
              </div>
            )}
          </div>

          {/* 移动端分类胶囊 */}
          <div className="flex md:hidden gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedCategoryId === cat.id
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-white text-gray-500 border border-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-center py-24 text-gray-400">加载中...</div>
          ) : dishes.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-gray-400">暂无相关菜品</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dishes.map((dish, idx) => {
                const qty = cart[dish.id] || 0
                return (
                  <div
                    key={dish.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-4 hover:shadow-md transition-all duration-200"
                  >
                    {/* 左侧图片 */}
                    <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-orange-100 to-amber-50 flex-shrink-0 flex items-center justify-center text-4xl shadow-sm">
                      {CARD_EMOJI[idx % CARD_EMOJI.length]}
                    </div>

                    {/* 右侧内容 */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-base truncate">{dish.name}</h3>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">精选优质食材，匠心制作，美味可口</p>
                      </div>

                      <div className="flex items-end justify-between mt-2">
                        <span className="text-lg font-bold text-orange-600 tracking-tight">
                          ¥{parseFloat(dish.price as unknown as string).toFixed(2)}
                        </span>

                        {/* 加减控制 */}
                        <div className="flex items-center gap-1.5">
                          {qty > 0 && (
                            <>
                              <button
                                onClick={() => removeFromCart(dish.id)}
                                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all active:scale-90 flex items-center justify-center text-lg leading-none"
                              >
                                −
                              </button>
                              <span className="w-5 text-center font-semibold text-gray-800 text-sm">{qty}</span>
                            </>
                          )}
                          <button
                            onClick={() => addToCart(dish.id)}
                            className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 transition-all active:scale-90 shadow-sm flex items-center justify-center text-lg leading-none"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ===== 右侧购物车（桌面端，30%） ===== */}
        <div className="hidden lg:block w-[30%] flex-shrink-0">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🛒</span>
              <h2 className="text-lg font-semibold text-gray-800">购物车</h2>
            </div>

            {cartCount === 0 ? (
              <p className="text-gray-400 text-sm py-10 text-center">购物车是空的</p>
            ) : (
              <div className="space-y-3 mb-4 max-h-72 overflow-y-auto scrollbar-thin">
                {Object.entries(cart).map(([id, qty]) => {
                  const dish = dishes.find(d => d.id === Number(id))
                  if (!dish) return null
                  const price = parseFloat(dish.price as unknown as string)
                  return (
                    <div key={id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-3 last:border-b-0 last:pb-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800 truncate font-medium">{dish.name}</p>
                        <p className="text-gray-400 text-xs mt-0.5">¥{price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <button
                          onClick={() => removeFromCart(dish.id)}
                          className="w-6 h-6 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-100 text-xs flex items-center justify-center transition-all active:scale-90"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-medium text-gray-800">{qty}</span>
                        <button
                          onClick={() => addToCart(dish.id)}
                          className="w-6 h-6 rounded-full bg-orange-500 text-white hover:bg-orange-600 text-xs flex items-center justify-center transition-all active:scale-90"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {cartCount > 0 && (
              <>
                <div className="border-t border-gray-100 pt-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">合计</span>
                    <span className="text-xl font-bold text-orange-600">¥{totalPrice.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-full hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-200 active:shadow-inner active:scale-[0.98]"
                >
                  {isSubmitting ? '提交中...' : '📦 提交订单'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ===== 移动端浮动购物车底栏 ===== */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        {cartCount > 0 && (
          <>
            {/* 展开的购物车面板 */}
            {showCartMobile && (
              <div className="bg-white/95 backdrop-blur-md border-t border-gray-200 px-5 pt-4 pb-2 max-h-64 overflow-y-auto shadow-2xl rounded-t-2xl">
                {Object.entries(cart).map(([id, qty]) => {
                  const dish = dishes.find(d => d.id === Number(id))
                  if (!dish) return null
                  const price = parseFloat(dish.price as unknown as string)
                  return (
                    <div key={id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-b-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800 truncate">{dish.name}</p>
                        <p className="text-gray-400 text-xs">¥{price.toFixed(2)} × {qty}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <button onClick={() => removeFromCart(dish.id)} className="w-6 h-6 rounded-full border border-gray-200 text-gray-400 text-xs flex items-center justify-center active:scale-90">−</button>
                        <span className="w-5 text-center text-sm font-medium text-gray-800">{qty}</span>
                        <button onClick={() => addToCart(dish.id)} className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center active:scale-90">+</button>
                      </div>
                    </div>
                  )
                })}
                <button
                  onClick={handleCheckout}
                  disabled={isSubmitting}
                  className="w-full mt-3 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-full disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {isSubmitting ? '提交中...' : '📦 提交订单'}
                </button>
              </div>
            )}

            {/* 底部结算条 */}
            <div className="bg-white/95 backdrop-blur-md border-t border-gray-200 px-5 py-3 flex items-center justify-between shadow-2xl">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCartMobile(prev => !prev)}
                  className="relative w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-200"
                >
                  🛒
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-white border-2 border-orange-500 rounded-full flex items-center justify-center text-[10px] font-bold text-orange-600">
                    {cartCount}
                  </span>
                </button>
                <span className="text-lg font-bold text-gray-800">¥{totalPrice.toFixed(2)}</span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={isSubmitting}
                className="px-8 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-full disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg"
              >
                去结算
              </button>
            </div>
          </>
        )}
      </div>

      {/* 移动端购物车底部间距 */}
      {cartCount > 0 && <div className="lg:hidden h-20"></div>}
    </div>
  )
}
