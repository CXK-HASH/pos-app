import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const getServiceKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ''

/** Haversine 距离（km） */
function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * 计算骑手配送费
 * 规则：1 公里起 2 元，每 0.5 公里加 1 元
 * 不足 1km 按 1km 算；超出部分每 0.5km 阶梯加 1 元
 */
function calcDriverFee(distanceKm: number): number {
  if (distanceKm <= 0) return 2
  // 起步 1km = 2 元，之后每 0.5km + 1 元
  const steps = Math.ceil(Math.max(0, distanceKm - 1) / 0.5)
  return 2 + steps
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { orderId, driverId } = body
    if (!orderId || !driverId) {
      return NextResponse.json({ error: 'orderId 和 driverId 为必填' }, { status: 400 })
    }

    // 验证身份
    const authHeader = request.headers.get('Authorization')
    let userId: string | null = null
    if (authHeader?.startsWith('Bearer ')) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        getServiceKey(),
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
      userId = user?.id ?? null
    }
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      getServiceKey(),
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 先查订单获得商户和消费者坐标
    const { data: order } = await supabase
      .from('orders')
      .select('merchant_lat, merchant_lng, consumer_lat, consumer_lng')
      .eq('id', Number(orderId))
      .single()

    if (!order) return NextResponse.json({ error: '订单不存在' }, { status: 404 })

    // 计算配送费
    let driverFee = 2 // 最低 2 元
    if (order.merchant_lat && order.merchant_lng && order.consumer_lat && order.consumer_lng) {
      const dist = calcDistance(
        Number(order.merchant_lat), Number(order.merchant_lng),
        Number(order.consumer_lat), Number(order.consumer_lng),
      )
      driverFee = calcDriverFee(dist)
    }

    // 并发安全抢单 + 写入配送费
    const { data, error } = await supabase
      .from('orders')
      .update({
        driver_id: userId,
        status: 'processing',
        driver_fee: driverFee,
      })
      .eq('id', Number(orderId))
      .is('driver_id', null)
      .select()

    if (error) {
      console.error('[ACCEPT_DEBUG] 更新失败:', JSON.stringify(error))
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: '订单已被抢走' }, { status: 409 })
    }

    return NextResponse.json({ success: true, order: data[0], driver_fee: driverFee })
  } catch (err) {
    console.error('[ACCEPT_DEBUG] 异常:', err)
    return NextResponse.json({ error: '抢单失败: ' + (err as Error).message }, { status: 500 })
  }
}
