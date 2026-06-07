'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type CartItem = { name: string; price: number; quantity: number }

type Order = {
  id: number
  total_price: number
  status: string
  items: CartItem[]
  merchant_id: number | null
  user_id: string | null
  driver_id: string | null
  created_at: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:    { label: '待支付',     color: 'bg-gray-100 text-gray-600' },
  paid:       { label: '已支付',     color: 'bg-blue-100 text-blue-700' },
  processing: { label: '制作中',     color: 'bg-yellow-100 text-yellow-700' },
  prepared:   { label: '已制作完成', color: 'bg-green-100 text-green-700' },
  shipping:   { label: '配送中',     color: 'bg-purple-100 text-purple-700' },
  completed:  { label: '已完成',     color: 'bg-green-100 text-green-700' },
}

const ROLE_TITLES: Record<string, string> = {
  consumer: '🛒 我的点单',
  merchant: '🏪 店铺订单',
  driver:   '🚴 配送订单',
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [role, setRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notLoggedIn, setNotLoggedIn] = useState(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const fetchOrders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const res = await fetch('/api/orders', {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
    const data = await res.json()
    if (data && Array.isArray(data.orders)) {
      setOrders(data.orders)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        setNotLoggedIn(true)
        setIsLoading(false)
        return
      }
      setRole(session.user.user_metadata?.role || 'consumer')
      fetchOrders().then(() => setIsLoading(false))
    })
  }, [fetchOrders])

  // 统一状态更新函数
  const updateStatus = async (orderId: number, status: string) => {
    setUpdatingId(orderId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ orderId, status }),
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || '操作失败')
      }
      await fetchOrders()
    } catch {
      alert('网络异常')
    } finally {
      setUpdatingId(null)
    }
  }

  if (notLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-gray-500 mb-4">请先登录后查看订单</p>
          <Link href="/login" className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium rounded-xl">
            去登录
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">
          {ROLE_TITLES[role || 'consumer'] || '📋 订单中心'}
        </h1>

        {isLoading ? (
          <div className="text-center py-20 text-gray-400">加载中...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-400">暂无订单</p>
            {role === 'consumer' && (
              <Link href="/" className="text-orange-600 text-sm mt-2 inline-block hover:underline">
                去点餐 →
              </Link>
            )}
            {role === 'merchant' && (
              <p className="text-gray-400 text-sm mt-2">还没有顾客下单</p>
            )}
            {role === 'driver' && (
              <p className="text-gray-400 text-sm mt-2">去抢单池接单吧</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const cfg = STATUS_LABELS[order.status] || STATUS_LABELS.pending
              const isProcessing = updatingId === order.id

              return (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-800">订单 #{order.id}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {role === 'merchant' && (
                        <span className="text-xs text-gray-400">
                          消费者: {(order.user_id || '-').slice(0, 8)}...
                        </span>
                      )}
                      {role === 'driver' && (
                        <span className="text-xs text-gray-400">
                          商家 ID: {order.merchant_id || '-'}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleString('zh-CN')}
                    </span>
                  </div>

                  <div className="border-t border-gray-50 pt-2 mb-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm py-1">
                        <span className="text-gray-700">{item.name}</span>
                        <span className="text-gray-500">¥{item.price} × {item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {/* 总价 */}
                  <div className="border-t border-gray-100 pt-3 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">商家 ID: {order.merchant_id || '-'}</span>
                      <span className="text-lg font-bold text-gray-900">
                        ¥{order.total_price.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* ===== 商家操作区 ===== */}
                  {role === 'merchant' && order.status === 'processing' && (
                    <button
                      onClick={() => updateStatus(order.id, 'prepared')}
                      disabled={isProcessing}
                      className="w-full py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 active:scale-[0.98]"
                    >
                      {isProcessing ? '处理中...' : '✅ 制作完成'}
                    </button>
                  )}

                  {/* ===== 骑手操作区 ===== */}
                  {role === 'driver' && order.status === 'prepared' && (
                    <button
                      onClick={() => updateStatus(order.id, 'shipping')}
                      disabled={isProcessing}
                      className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 active:scale-[0.98]"
                    >
                      {isProcessing ? '处理中...' : '🥡 已取货配送'}
                    </button>
                  )}
                  {role === 'driver' && order.status === 'shipping' && (
                    <button
                      onClick={() => updateStatus(order.id, 'completed')}
                      disabled={isProcessing}
                      className="w-full py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 active:scale-[0.98]"
                    >
                      {isProcessing ? '处理中...' : '🏁 已送达顾客'}
                    </button>
                  )}
                  {/* 骑手看到非 shipping/prepared 状态的订单时，按钮置灰 */}
                  {role === 'driver' && order.status !== 'prepared' && order.status !== 'shipping' && (
                    <button
                      disabled
                      className="w-full py-2.5 bg-gray-300 text-gray-500 font-semibold rounded-xl cursor-not-allowed"
                    >
                      {order.status === 'processing' ? '⏳ 等待商家制作' : `⏳ 当前状态: ${cfg.label}`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
