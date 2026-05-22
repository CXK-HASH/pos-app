'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Order = {
  id: number
  total_price: number
  status: string
  items: { name: string; price: number; quantity: number }[]
  merchant_id: number | null
  created_at: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:    { label: '待支付',     color: 'bg-gray-100 text-gray-600' },
  paid:       { label: '已支付',     color: 'bg-blue-100 text-blue-700' },
  processing: { label: '制作中',     color: 'bg-yellow-100 text-yellow-700' },
  completed:  { label: '已完成',     color: 'bg-green-100 text-green-700' },
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [notLoggedIn, setNotLoggedIn] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        setNotLoggedIn(true)
        setIsLoading(false)
        return
      }

      fetch('/api/orders', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setOrders(data)
          setIsLoading(false)
        })
        .catch(() => setIsLoading(false))
    })
  }, [])

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
        <h1 className="text-xl font-bold text-gray-900 mb-6">📋 我的订单</h1>

        {isLoading ? (
          <div className="text-center py-20 text-gray-400">加载中...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-400">暂无订单</p>
            <Link href="/" className="text-orange-600 text-sm mt-2 inline-block hover:underline">
              去点餐 →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const cfg = STATUS_LABELS[order.status] || STATUS_LABELS.pending
              return (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
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

                  <div className="border-t border-gray-50 pt-2 mb-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm py-1">
                        <span className="text-gray-700">{item.name}</span>
                        <span className="text-gray-500">¥{item.price} × {item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-100 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">商家 ID: {order.merchant_id || '-'}</span>
                      <span className="text-lg font-bold text-gray-900">
                        ¥{parseFloat(order.total_price as unknown as string).toFixed(2)}
                      </span>
                    </div>
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
