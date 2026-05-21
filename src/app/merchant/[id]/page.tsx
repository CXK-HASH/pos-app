'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

type Dish = {
  id: number
  name: string
  price: number
  image_url: string | null
  merchant_id: number
}

type Merchant = {
  id: number
  name: string
  logo_url: string | null
  rating: number
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function MerchantPage() {
  const params = useParams()
  const merchantId = Number(params.id)

  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [dishes, setDishes] = useState<Dish[]>([])
  const [cart, setCart] = useState<Record<number, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('merchants').select('*').eq('id', merchantId).single(),
      supabase.from('dishes').select('*').eq('merchant_id', merchantId).order('id', { ascending: true }),
    ]).then(([merchantRes, dishesRes]) => {
      if (!merchantRes.error && merchantRes.data) setMerchant(merchantRes.data)
      if (!dishesRes.error && dishesRes.data) setDishes(dishesRes.data)
      setIsLoading(false)
    })
  }, [merchantId])

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

  const totalPrice = Object.entries(cart).reduce((sum, [id, qty]) => {
    const dish = dishes.find(d => d.id === Number(id))
    return sum + (dish ? dish.price * qty : 0)
  }, 0)

  const handleCheckout = async () => {
    const items = Object.entries(cart).map(([id, qty]) => {
      const dish = dishes.find(d => d.id === Number(id))
      return { id: Number(id), name: dish?.name, price: dish?.price, quantity: qty }
    })

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart: items, totalPrice, merchantId }),
      })
      const data = await res.json()
      if (data.success) {
        setCart({})
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
            ← 返回
          </Link>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-sm">
            🏪
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">{merchant?.name || '商家'}</h1>
            <p className="text-xs text-gray-400">⭐ {merchant?.rating || '-'} 分</p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 flex gap-6">
        {/* ======== 左侧：菜品列表 ======== */}
        <div className="w-[70%]">
          {dishes.length === 0 ? (
            <div className="text-center py-20 text-gray-400">该商家暂无菜品</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dishes.map(dish => {
                const qty = cart[dish.id] || 0
                return (
                  <div
                    key={dish.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="h-36 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-5xl">
                      🍽️
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-800 text-lg">{dish.name}</h3>
                      <p className="text-orange-600 font-bold text-lg mt-1">¥{parseFloat(dish.price as unknown as string).toFixed(2)}</p>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => removeFromCart(dish.id)}
                            className="w-8 h-8 rounded-full border border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors text-lg leading-none"
                          >
                            −
                          </button>
                          <span className="w-6 text-center font-medium text-gray-800">{qty}</span>
                          <button
                            onClick={() => addToCart(dish.id)}
                            className="w-8 h-8 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors text-lg leading-none"
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

        {/* ======== 右侧：购物车 ======== */}
        <div className="w-[30%]">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sticky top-24">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">🛒 购物车</h2>

            {Object.keys(cart).length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">购物车是空的</p>
            ) : (
              <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
                {Object.entries(cart).map(([id, qty]) => {
                  const dish = dishes.find(d => d.id === Number(id))
                  if (!dish) return null
                  const price = parseFloat(dish.price as unknown as string)
                  return (
                    <div key={id} className="flex items-center justify-between text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800 truncate">{dish.name}</p>
                        <p className="text-gray-400 text-xs">¥{price.toFixed(2)} × {qty}</p>
                      </div>
                      <p className="font-medium text-gray-800 ml-2 shrink-0">
                        ¥{(price * qty).toFixed(2)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}

            {Object.keys(cart).length > 0 && (
              <>
                <div className="border-t border-gray-100 pt-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">合计</span>
                    <span className="text-xl font-bold text-orange-600">¥{totalPrice.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-orange-200"
                >
                  {isSubmitting ? '提交中...' : '📦 提交订单'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
