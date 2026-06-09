'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import NavigationMap from '@/components/NavigationMap'
import MapPicker from '@/components/MapPicker'
import { getDistance, formatDistance } from '@/lib/distance'

type Order = {
  id: number
  total_price: number
  status: string
  items: { name: string; quantity: number }[]
  merchant_id: number | null
  driver_id: string | null
  user_id: string | null
  meal_prepared: boolean
  driver_arrived: boolean
  merchant_name?: string
  merchant_address: string | null
  merchant_lat: number | null
  merchant_lng: number | null
  consumer_address: string | null
  consumer_lat: number | null
  consumer_lng: number | null
  driver_fee: number | null
  created_at: string
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  paid:      { label: '待取餐',   color: 'bg-yellow-900/40 text-yellow-400' },
  processing:{ label: '制作中',   color: 'bg-blue-900/40 text-blue-400' },
  prepared:  { label: '已制作完成', color: 'bg-green-900/40 text-green-400' },
  shipping:  { label: '配送中',   color: 'bg-purple-900/40 text-purple-400' },
  completed: { label: '已送达',   color: 'bg-green-900/40 text-green-400' },
}

export default function DriverDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [pool, setPool] = useState<Order[]>([])
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  // 骑手定位
  const [driverLat, setDriverLat] = useState<number>(23.1291)
  const [driverLng, setDriverLng] = useState<number>(113.2644)
  const [driverAddress, setDriverAddress] = useState<string>('正在定位...')
  const [locationReady, setLocationReady] = useState(false)
  const locationInited = useRef(false)

  // 地址弹窗
  const [showMap, setShowMap] = useState(false)

  // 导航状态
  const [navOrder, setNavOrder] = useState<Order | null>(null)
  const [showNav, setShowNav] = useState(false)

  // 路由守卫 + 百度地图定位
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
      if (role !== 'driver') {
        alert('权限不足，只有骑手可访问此页面！')
        localStorage.clear()
        sessionStorage.clear()
        window.location.href = '/'
        return
      }
      setUser({ id: session.user.id, email: session.user.email || '' })
    })
  }, [router])

  // 百度地图定位（只在初始化时跑一次）
  useEffect(() => {
    if (locationInited.current) return
    locationInited.current = true

    const tryLocate = () => {
      if (typeof window === 'undefined' || !window.BMap) {
        setTimeout(tryLocate, 500)
        return
      }
      try {
        const geolocation = new window.BMap.Geolocation()
        geolocation.getCurrentPosition(
          (r: { point: { lat: number; lng: number }; address: { city: string; district: string; street: string; streetNumber: string } }) => {
            if (r) {
              setDriverLat(r.point.lat)
              setDriverLng(r.point.lng)
              const addr = r.address
              if (addr) {
                const safeNum = addr.streetNumber || ''
                const addrStr = `${addr.city || ''}${addr.district || ''}${addr.street || ''}${safeNum}`.replace(/undefined/gi, '').trim()
                setDriverAddress(addrStr)
              } else {
                setDriverAddress(`${r.point.lat.toFixed(4)}, ${r.point.lng.toFixed(4)}`)
              }
              setLocationReady(true)
            }
          },
          () => {
            // 定位失败，回退默认
            setDriverAddress('定位失败，使用默认位置')
            setLocationReady(true)
          },
          { enableHighAccuracy: true }
        )
      } catch {
        setDriverAddress('定位异常')
        setLocationReady(true)
      }
    }
    tryLocate()
  }, [])

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
    const interval = setInterval(fetchData, 5000)
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
    if (data.success) fetchData()
    else alert('抢单失败: ' + (data.error || '已被抢走'))
  }

  const handleAction = async (orderId: number, payload: Record<string, unknown>) => {
    setActionLoading(orderId)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setActionLoading(null); return }

    const res = await fetch('/api/driver/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ orderId, ...payload }),
    })
    const data = await res.json()
    if (data.success) fetchData()
    else alert('操作失败: ' + (data.error || '未知错误'))
    setActionLoading(null)
  }

  /** 百度地图外跳导航：取餐/送餐双段 */
  const handleNavigate = (order: Order, type: 'pickup' | 'deliver') => {
    if (!driverLat || !driverLng) {
      alert('骑手位置未获取，请等待定位完成')
      return
    }

    if (type === 'pickup') {
      if (!order.merchant_lat || !order.merchant_lng) {
        alert('商家位置信息不全')
        return
      }
      const url = `https://api.map.baidu.com/direction?origin=${driverLat},${driverLng}&destination=${order.merchant_lat},${order.merchant_lng}&mode=riding&region=全国&output=html&src=webapp.delivery.posapp`
      console.log('🚀 [BAIDU_MAP_NAV] 导航取餐:', url)
      window.open(url, '_blank')
    } else {
      if (!order.consumer_lat || !order.consumer_lng) {
        alert('送餐位置信息不全')
        return
      }
      const url = `https://api.map.baidu.com/direction?origin=${driverLat},${driverLng}&destination=${order.consumer_lat},${order.consumer_lng}&mode=riding&region=全国&output=html&src=webapp.delivery.posapp`
      console.log('🚀 [BAIDU_MAP_NAV] 导航送餐:', url)
      window.open(url, '_blank')
    }
  }

  if (!user) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">加载中...</div>
  }

  // 渲染抢单池卡片
  const renderPoolCard = (order: Order) => {
    const distToMerchant = order.merchant_lat && order.merchant_lng
      ? getDistance(driverLat, driverLng, order.merchant_lat, order.merchant_lng)
      : null
    const distMerchantToConsumer = order.merchant_lat && order.merchant_lng && order.consumer_lat && order.consumer_lng
      ? getDistance(order.merchant_lat, order.merchant_lng, order.consumer_lat, order.consumer_lng)
      : null

    return (
      <div key={order.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white font-medium">订单 #{order.id}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[order.status]?.color || ''}`}>
            {STATUS_BADGE[order.status]?.label || order.status}
          </span>
        </div>

        {/* 空间距离信息 */}
        <div className="text-sm text-gray-400 mb-1">
          🏪 {order.merchant_name || `商家 #${order.merchant_id}`}
        </div>
        {order.merchant_address && (
          <div className="text-xs text-gray-500 mb-1">
            📍 {order.merchant_address}
            {distToMerchant !== null && locationReady && (
              <span className="text-yellow-400 ml-2">距你 {formatDistance(distToMerchant)}</span>
            )}
          </div>
        )}
        {distMerchantToConsumer !== null && order.consumer_address && (
          <div className="text-xs text-gray-500 mb-1">
            🏁 送达: {order.consumer_address}
            <span className="text-gray-400 ml-2">商户距顾客 {formatDistance(distMerchantToConsumer)}</span>
          </div>
        )}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-orange-400 font-bold text-lg">💰 收益 ¥{parseFloat(String(order.driver_fee || 0)).toFixed(2)}</span>
          {distMerchantToConsumer !== null && (
            <span className="text-xs text-gray-500">配送 {formatDistance(distMerchantToConsumer)}</span>
          )}
        </div>
        <button
          onClick={() => handleAccept(order.id)}
          className="w-full py-2.5 bg-gradient-to-r from-yellow-600 to-amber-600 text-white font-semibold rounded-xl hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          ⚡ 立即抢单
        </button>
      </div>
    )
  }

  // 渲染配送卡片
  const renderDeliveryCard = (order: Order) => {
    const mAddr = order.merchant_address
    const cAddr = order.consumer_address
    const isLoading = actionLoading === order.id

    const distToMerchant = order.merchant_lat && order.merchant_lng
      ? getDistance(driverLat, driverLng, order.merchant_lat, order.merchant_lng)
      : null
    const distMerchantToConsumer = order.merchant_lat && order.merchant_lng && order.consumer_lat && order.consumer_lng
      ? getDistance(order.merchant_lat, order.merchant_lng, order.consumer_lat, order.consumer_lng)
      : null

    return (
      <div key={order.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white font-medium">订单 #{order.id}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[order.status]?.color || ''}`}>
            {STATUS_BADGE[order.status]?.label || order.status}
          </span>
        </div>

        {/* 地址信息 */}
        {mAddr && (
          <div className="text-xs text-gray-500 mb-1">
            🏪 {order.merchant_name || `商家 #${order.merchant_id}`}: {mAddr}
            {distToMerchant !== null && (
              <span className="text-gray-400 ml-2">距你 {formatDistance(distToMerchant)}</span>
            )}
          </div>
        )}
        {cAddr && (
          <div className="text-xs text-gray-500 mb-1">
            🏁 送达: {cAddr}
            {distMerchantToConsumer !== null && (
              <span className="text-gray-400 ml-2">距商家 {formatDistance(distMerchantToConsumer)}</span>
            )}
          </div>
        )}

        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-orange-400 font-bold text-lg">💰 收益 ¥{parseFloat(String(order.driver_fee || 0)).toFixed(2)}</span>
          <span className="text-xs text-gray-500">顾客实付 ¥{parseFloat(String(order.total_price)).toFixed(2)}</span>
        </div>

        {/* 双因子状态指示器 */}
        {(order.status === 'processing' || order.status === 'prepared' || order.status === 'shipping') && (
          <div className="flex gap-2 mb-2 text-xs">
            <span className={`px-2 py-1 rounded ${order.meal_prepared ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
              🍳 商家: {order.meal_prepared ? '已完成' : '制作中'}
            </span>
            <span className={`px-2 py-1 rounded ${order.driver_arrived ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
              🚴 取货: {order.driver_arrived ? '已取货' : '未取货'}
            </span>
          </div>
        )}

        {/* 导航按钮 */}
        {mAddr && order.merchant_lat && order.merchant_lng && (
          <button
            onClick={() => handleNavigate(order, 'pickup')}
            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 mb-2"
          >
            🗺️ 百度导航取餐
          </button>
        )}

        {/* 骑手操作区 */}
        {!order.driver_arrived && (order.status === 'processing' || order.status === 'prepared') && (
          <button
            onClick={() => handleAction(order.id, { driver_arrived: true })}
            disabled={isLoading}
            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mb-2"
          >
            {isLoading ? '处理中...' : '🥡 已到店取货'}
          </button>
        )}

        {order.driver_arrived && !order.meal_prepared && (
          <div className="w-full py-2 text-center text-sm text-blue-400 bg-blue-900/20 rounded-xl mb-2">
            🥡 已取货，等待商家制作完成
          </div>
        )}

        {order.meal_prepared && order.driver_arrived && order.status !== 'shipping' && order.status !== 'completed' && (
          <button
            onClick={() => handleAction(order.id, { status: 'shipping' })}
            disabled={isLoading}
            className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mb-2"
          >
            {isLoading ? '处理中...' : '🚚 开始配送'}
          </button>
        )}

        {order.status === 'shipping' && (
          <>
            {/* 送餐导航 */}
            {order.consumer_lat && order.consumer_lng && (
              <button
                onClick={() => handleNavigate(order, 'deliver')}
                className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 mb-2"
              >
                🚴 百度导航送餐
              </button>
            )}
            <button
              onClick={() => handleAction(order.id, { status: 'completed' })}
              disabled={isLoading}
              className="w-full py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? '处理中...' : '🏁 已送达顾客'}
            </button>
          </>
        )}

        {order.status === 'processing' && !order.meal_prepared && !order.driver_arrived && (
          <button disabled className="w-full py-2.5 bg-gray-700 text-gray-500 font-semibold rounded-xl cursor-not-allowed">
            ⏳ 等待商家制作完成
          </button>
        )}

        {order.status === 'completed' && (
          <div className="w-full py-2 text-center text-sm text-green-400 bg-green-900/20 rounded-xl">
            ✅ 订单已送达
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* 顶栏 */}
      <header className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold text-lg">🚴 小龙虾配送 · 骑手大厅</span>
            <span className="text-gray-500 text-sm hidden sm:inline">{user.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              待抢 <span className="text-yellow-400 font-bold">{pool.length}</span>
              &nbsp;·&nbsp; 配送中 <span className="text-blue-400 font-bold">{myOrders.length}</span>
            </span>
            {/* 当前位置 — 全角色可点击唤起选址弹窗 */}
            {locationReady && (
              <button
                onClick={() => setShowMap(true)}
                className="hidden md:inline-flex items-center gap-1 text-xs text-gray-600 max-w-[200px] truncate cursor-pointer hover:text-orange-500 transition-colors"
                title={driverAddress}
              >
                <span>📍</span>
                <span className="truncate">{driverAddress}</span>
              </button>
            )}
            <button
              onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
              className="px-4 py-1.5 text-sm bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700"
            >
              退出
            </button>
          </div>
        </div>

        {/* ===== 百度地图地址选择弹窗 ===== */}
        <MapPicker
          open={showMap}
          onClose={() => setShowMap(false)}
          onConfirm={(addr: string, lat: number, lng: number) => {
            setDriverAddress(addr)
            setDriverLat(lat)
            setDriverLng(lng)
            localStorage.setItem('driver_address', addr)
            localStorage.setItem('driver_lat', String(lat))
            localStorage.setItem('driver_lng', String(lng))
            // 联动天气：提取 adcode
            if (typeof window !== 'undefined' && (window as any).BMap) {
              try {
                const pt = new (window as any).BMap.Point(lng, lat)
                const gc = new (window as any).BMap.Geocoder()
                gc.getLocation(pt, (rs: any) => {
                  const adcode = rs?.addressComponents?.adcode
                  if (adcode) localStorage.setItem('driver_adcode', String(adcode))
                  window.dispatchEvent(new Event('storage'))
                })
              } catch { /* ignore */ }
            }
            setShowMap(false)
          }}
          initialAddress={driverAddress}
          initialLat={driverLat}
          initialLng={driverLng}
        />
      </header>

      {loading ? (
        <div className="max-w-6xl mx-auto px-6 py-20 text-center text-gray-500">加载中...</div>
      ) : (
        <div className="max-w-6xl mx-auto px-6 py-6 flex gap-6 flex-col lg:flex-row">
          {/* 左侧：抢单池 */}
          <div className="lg:w-1/2">
            <h2 className="text-lg font-semibold text-white mb-4">⚡ 全城抢单池</h2>
            {pool.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-sm">暂无待抢订单</div>
            ) : (
              <div className="space-y-3">{pool.map(renderPoolCard)}</div>
            )}
          </div>

          {/* 右侧：我的配送 */}
          <div className="lg:w-1/2">
            <h2 className="text-lg font-semibold text-white mb-4">📦 我正在配送</h2>
            {myOrders.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-sm">暂无配送订单</div>
            ) : (
              <div className="space-y-3">{myOrders.map(renderDeliveryCard)}</div>
            )}
          </div>
        </div>
      )}

      {/* 导航地图弹窗 */}
      {navOrder && showNav && (
        <NavigationMap
          open={showNav}
          onClose={() => setShowNav(false)}
          merchantName={navOrder.merchant_name || '商家'}
          fromLat={navOrder.merchant_lat || 23.1291}
          fromLng={navOrder.merchant_lng || 113.2644}
          toAddress={navOrder.consumer_address || '送达地址'}
          toLat={navOrder.consumer_lat || 23.136}
          toLng={navOrder.consumer_lng || 113.27}
        />
      )}
    </div>
  )
}
