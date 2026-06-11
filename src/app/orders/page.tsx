'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import MapPicker from '@/components/MapPicker'

/**
 * 每个订单独立的地址选择器
 * 一次选择后锁定，不再弹出
 */
function AddressSelector({ orderId, onAddressSet }: { orderId: number; onAddressSet: () => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleConfirm = async (addr: string, lat: number, lng: number) => {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          orderId,
          consumer_address: addr,
          consumer_lat: lat,
          consumer_lng: lng,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setOpen(false)
        onAddressSet()
      } else {
        alert(data.error || '保存地址失败')
      }
    } catch {
      alert('网络异常')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={saving}
        className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 active:scale-[0.98]"
      >
        {saving ? '保存中...' : '📍 选择配送地址'}
      </button>
      <MapPicker
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  )
}

type CartItem = { name: string; price: number; quantity: number }

type Order = {
  id: number
  total_price: number
  status: string
  items: CartItem[]
  merchant_id: number | null
  user_id: string | null
  driver_id: string | null
  meal_prepared: boolean
  driver_arrived: boolean
  created_at: string
  consumer_address: string | null
  consumer_lat: number | null
  consumer_lng: number | null
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
  const [actionLoading, setActionLoading] = useState<number | null>(null)

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

  // 统一操作回调：支持 status 更新和布尔字段更新
  const doAction = async (orderId: number, payload: Record<string, unknown>) => {
    setActionLoading(orderId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ orderId, ...payload }),
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || '操作失败')
      }
      await fetchOrders()
    } catch {
      alert('网络异常')
    } finally {
      setActionLoading(null)
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
              const isLoading = actionLoading === order.id

              return (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  {/* 头部：订单号 + 状态标签 */}
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

                  {/* 商品明细 */}
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

                  {/* ========== 消费者操作区 ========== */}
                  {role === 'consumer' && (
                    <>
                      {/* 选择配送地址：仅当未设置地址时展示，每个订单最多一次 */}
                      {!order.consumer_lat && !order.consumer_lng && (
                        <AddressSelector orderId={order.id} onAddressSet={fetchOrders} />
                      )}
                      {order.consumer_address && (
                        <div className="text-center text-xs text-gray-500 py-2 bg-gray-50 rounded-xl">
                          📍 配送至: {order.consumer_address}
                        </div>
                      )}
                    </>
                  )}

                  {/* ========== 双线程操作区 ========== */}

                  {/* === 商家： 「制作完成」按钮 === */}
                  {role === 'merchant' && (
                    <>
                      {order.status === 'processing' && !order.meal_prepared && (
                        <button
                          onClick={() => doAction(order.id, { meal_prepared: true })}
                          disabled={isLoading}
                          className="w-full py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 active:scale-[0.98]"
                        >
                          {isLoading ? '处理中...' : '✅ 制作完成'}
                        </button>
                      )}
                      {order.meal_prepared && (
                        <div className="text-center text-sm text-green-600 font-medium py-2 bg-green-50 rounded-xl">
                          ✅ 已标记制作完成
                        </div>
                      )}
                    </>
                  )}

                  {/* === 骑手操作区 === */}
                  {role === 'driver' && (
                    <>
                      {/* 状态指示器：双因子锁状态 */}
                      {(order.status === 'processing' || order.status === 'prepared' || order.status === 'shipping') && (
                        <div className="flex gap-2 mb-3 text-xs">
                          <span className={`px-2 py-1 rounded ${order.meal_prepared ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                            🍳 商家: {order.meal_prepared ? '已完成' : '制作中'}
                          </span>
                          <span className={`px-2 py-1 rounded ${order.driver_arrived ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                            🚴 取货: {order.driver_arrived ? '已取货' : '未取货'}
                          </span>
                        </div>
                      )}

                      {/* 「已到店取货」按钮：只要有 driver_id 绑定即可 */}
                      {!order.driver_arrived && (order.status === 'processing' || order.status === 'prepared') && (
                        <button
                          onClick={() => doAction(order.id, { driver_arrived: true })}
                          disabled={isLoading}
                          className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 active:scale-[0.98]"
                        >
                          {isLoading ? '处理中...' : '🥡 已到店取货'}
                        </button>
                      )}
                      {order.driver_arrived && !order.meal_prepared && (
                        <div className="text-center text-sm text-blue-600 font-medium py-2 bg-blue-50 rounded-xl">
                          🥡 已取货，等待商家制作完成
                        </div>
                      )}

                      {/* 「已送达顾客」按钮：复合锁——必须 meal_prepared && driver_arrived */}
                      {!order.driver_arrived && order.status !== 'shipping' && order.status !== 'completed' && !order.meal_prepared && !order.driver_arrived && order.status !== 'completed' && (
                        <button
                          disabled
                          className="w-full py-2.5 bg-gray-300 text-gray-500 font-semibold rounded-xl cursor-not-allowed"
                        >
                          ⏳ 等待商家制作并到店取货
                        </button>
                      )}

                      {order.driver_arrived && !order.meal_prepared && (
                        <button
                          disabled
                          className="w-full py-2.5 bg-gray-300 text-gray-500 font-semibold rounded-xl cursor-not-allowed"
                        >
                          ⏳ 等待商家制作完成才能送达
                        </button>
                      )}

                      {order.meal_prepared && !order.driver_arrived && (
                        <button
                          disabled
                          className="w-full py-2.5 bg-gray-300 text-gray-500 font-semibold rounded-xl cursor-not-allowed"
                        >
                          ⏳ 先去店里取货再送达
                        </button>
                      )}

                      {/* 双因子都满足：解锁「已送达」 */}
                      {order.meal_prepared && order.driver_arrived && order.status !== 'completed' && order.status !== 'shipping' && (
                        <button
                          onClick={() => doAction(order.id, { status: 'shipping' })}
                          disabled={isLoading}
                          className="w-full py-2.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 active:scale-[0.98]"
                        >
                          {isLoading ? '处理中...' : '🚚 开始配送'}
                        </button>
                      )}

                      {order.status === 'shipping' && order.meal_prepared && order.driver_arrived && (
                        <button
                          onClick={() => doAction(order.id, { status: 'completed' })}
                          disabled={isLoading}
                          className="w-full py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 active:scale-[0.98]"
                        >
                          {isLoading ? '处理中...' : '🏁 已送达顾客'}
                        </button>
                      )}

                      {order.status === 'completed' && (
                        <div className="text-center text-sm text-green-600 font-medium py-2 bg-green-50 rounded-xl">
                          ✅ 订单已完成
                        </div>
                      )}
                    </>
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
