'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Order = {
  id: number
  total_price: number
  status: string
  items: { name: string; quantity: number }[]
  merchant_id: number | null
  driver_id: string | null
  user_id: string | null
  created_at: string
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  paid:      { label: '待取餐',   color: 'bg-yellow-900/40 text-yellow-400' },
  processing:{ label: '制作中',   color: 'bg-blue-900/40 text-blue-400' },
  shipping:  { label: '配送中',   color: 'bg-purple-900/40 text-purple-400' },
  completed: { label: '已送达',   color: 'bg-green-900/40 text-green-400' },
}

export default function DriverDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [pool, setPool] = useState<Order[]>([])
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  // 路由守卫
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { router.push('/login'); return }
      const role = session.user.user_metadata?.role
      if (role !== 'driver') {
        alert('权限不足，只有骑手可访问此页面！')
        router.push('/')
        return
      }
      setUser({ id: session.user.id, email: session.user.email || '' })
    })
  }, [router])

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const headers = { 'Authorization': `Bearer ${session.access_token}` }

    const [poolRes, ordersRes] = await Promise.all([
      fetch('/api/driver/pool'),
      fetch('/api/driver/orders', { headers }),
    ])

    const poolData = await poolRes.json()
    const ordersData = await ordersRes.json()

    if (Array.isArray(poolData)) setPool(poolData)
    if (Array.isArray(ordersData)) setMyOrders(ordersData)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    // 每 3 秒刷新
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleAccept = async (orderId: number) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const res = await fetch('/api/driver/accept', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ orderId, driverId: user?.id }),
    })
    const data = await res.json()
    if (data.success) {
      fetchData()
    } else {
      alert('抢单失败: ' + (data.error || '已被抢走'))
    }
  }

  const handleStatus = async (orderId: number, status: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const res = await fetch('/api/driver/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ orderId, status }),
    })
    const data = await res.json()
    if (data.success) {
      fetchData()
    } else {
      alert('操作失败: ' + (data.error || '未知错误'))
    }
  }

  if (!user) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">加载中...</div>
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* 顶栏 */}
      <header className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold text-lg">🚴 小龙虾配送 · 骑手大厅</span>
            <span className="text-gray-500 text-sm hidden sm:inline">| {user.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              待抢 <span className="text-yellow-400 font-bold">{pool.length}</span>
              &nbsp;·&nbsp; 配送中 <span className="text-blue-400 font-bold">{myOrders.length}</span>
            </span>
            <button
              onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
              className="px-4 py-1.5 text-sm bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="max-w-6xl mx-auto px-6 py-20 text-center text-gray-500">加载中...</div>
      ) : (
        <div className="max-w-6xl mx-auto px-6 py-6 flex gap-6 flex-col lg:flex-row">
          {/* 左侧：抢单池 (50%) */}
          <div className="lg:w-1/2">
            <h2 className="text-lg font-semibold text-white mb-4">⚡ 全城抢单池</h2>
            {pool.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-sm">暂无待抢订单</div>
            ) : (
              <div className="space-y-3">
                {pool.map(order => (
                  <div key={order.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">订单 #{order.id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[order.status]?.color || ''}`}>
                        {STATUS_BADGE[order.status]?.label || order.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 mb-1">
                      商家 ID: {order.merchant_id || '-'} · {order.items?.length || 0} 件商品
                    </div>
                    <div className="text-orange-400 font-bold text-lg mb-3">¥{parseFloat(order.total_price as unknown as string).toFixed(2)}</div>
                    <button
                      onClick={() => handleAccept(order.id)}
                      className="w-full py-2.5 bg-gradient-to-r from-yellow-600 to-amber-600 text-white font-semibold rounded-xl hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      ⚡ 立即抢单
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 右侧：我的配送 (50%) */}
          <div className="lg:w-1/2">
            <h2 className="text-lg font-semibold text-white mb-4">📦 我正在配送</h2>
            {myOrders.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-sm">暂无配送订单</div>
            ) : (
              <div className="space-y-3">
                {myOrders.map(order => (
                  <div key={order.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">订单 #{order.id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[order.status]?.color || ''}`}>
                        {STATUS_BADGE[order.status]?.label || order.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 mb-1">
                      商家 ID: {order.merchant_id || '-'} · {order.items?.length || 0} 件商品
                    </div>
                    <div className="text-orange-400 font-bold text-lg mb-3">¥{parseFloat(order.total_price as unknown as string).toFixed(2)}</div>

                    {order.status === 'processing' && (
                      <button
                        onClick={() => handleStatus(order.id, 'shipping')}
                        className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
                      >
                        🥡 已到店取货
                      </button>
                    )}
                    {order.status === 'shipping' && (
                      <button
                        onClick={() => handleStatus(order.id, 'completed')}
                        className="w-full py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
                      >
                        🏁 已送达顾客
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
