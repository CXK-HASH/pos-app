'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Order = {
  id: number
  total_price: number
  status: 'pending' | 'paid' | 'processing' | 'completed'
  items: { id: number; name: string; price: number; quantity: number }[]
  merchant_id: number | null
  created_at: string
}

type Merchant = {
  id: number
  name: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; nextAction: string | null; nextStatus: string | null }> = {
  pending:    { label: '待支付',     color: 'bg-gray-100 text-gray-600',     nextAction: '💰 模拟支付',   nextStatus: 'paid' },
  paid:       { label: '待接单',     color: 'bg-blue-100 text-blue-700',     nextAction: '👨‍🍳 商家接单', nextStatus: 'processing' },
  processing: { label: '制作中',     color: 'bg-yellow-100 text-yellow-700', nextAction: '🛵 模拟送达',   nextStatus: 'completed' },
  completed:  { label: '已完成',     color: 'bg-green-100 text-green-700',   nextAction: null,             nextStatus: null },
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadOrders = useCallback(async () => {
    const [ordersRes, merchantsRes] = await Promise.all([
      fetch('/api/orders').then(r => r.json()),
      fetch('/api/merchants').then(r => r.json()),
    ])
    setOrders(ordersRes)
    setMerchants(merchantsRes)
    setIsLoading(false)
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])

  const handleStatusUpdate = async (orderId: number, newStatus: string) => {
    const res = await fetch('/api/orders/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status: newStatus }),
    })
    const data = await res.json()
    if (data.success) {
      loadOrders()
    } else {
      alert('❌ 操作失败: ' + (data.error || '未知错误'))
    }
  }

  const getMerchantName = (merchantId: number | null) => {
    if (!merchantId) return '未知商家'
    const m = merchants.find(m => m.id === merchantId)
    return m?.name || '未知商家'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">← 返回首页</Link>
            <h1 className="text-xl font-bold text-gray-800">📋 订单管理面板</h1>
          </div>
          <button
            onClick={loadOrders}
            className="px-4 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
          >
            🔄 刷新
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="text-center py-20 text-gray-400">加载中...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-400">暂无订单</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const cfg = STATUS_CONFIG[order.status]
              return (
                <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  {/* 订单头部 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-800">订单 #{order.id}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleString('zh-CN')}
                    </span>
                  </div>

                  {/* 商家信息 */}
                  <p className="text-xs text-gray-400 mb-2">🏪 {getMerchantName(order.merchant_id)}</p>

                  {/* 商品列表 */}
                  <div className="border-t border-gray-50 pt-2 mb-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm py-1">
                        <span className="text-gray-700">{item.name}</span>
                        <span className="text-gray-500">¥{item.price} × {item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {/* 底部：总价 + 操作按钮 */}
                  <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-800">
                      合计: ¥{parseFloat(order.total_price as unknown as string).toFixed(2)}
                    </span>
                    {cfg.nextAction && cfg.nextStatus ? (
                      <button
                        onClick={() => handleStatusUpdate(order.id, cfg.nextStatus!)}
                        className="px-5 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors shadow-sm"
                      >
                        {cfg.nextAction}
                      </button>
                    ) : (
                      <span className="text-sm text-green-600 font-medium">✅ 订单已完成</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
