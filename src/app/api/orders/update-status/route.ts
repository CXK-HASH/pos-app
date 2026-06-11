import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const getServiceKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ''

// 状态机合法流转表
// 注意：meal_prepared 和 driver_arrived 独立控制，不阻塞 status 串行
// status 用于UI筛选，meal_prepared/driver_arrived 用于复合锁
const STATE_MACHINE: Record<string, string[]> = {
  pending:     ['paid', 'processing'],
  paid:        ['processing'],
  processing:  ['shipping', 'completed'],  // 允许跳过 prepared 直接 shipping（老订单兼容）
  prepared:    ['shipping'],
  shipping:    ['completed'],
  completed:   [],
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId, status: targetStatus, meal_prepared, driver_arrived, consumer_address, consumer_lat, consumer_lng } = body

    if (!orderId) {
      return NextResponse.json({ error: 'orderId 不能为空' }, { status: 400 })
    }

    // 验证用户身份
    const authHeader = request.headers.get('Authorization')
    let userId: string | null = null
    let userRole: string | null = null
    if (authHeader?.startsWith('Bearer ')) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        getServiceKey(),
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
      userId = user?.id ?? null
      userRole = user?.user_metadata?.role ?? null
    }

    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      getServiceKey(),
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. 先查询当前订单状态
    const { data: currentOrder, error: queryError } = await supabase
      .from('orders')
      .select('id, status, merchant_id, driver_id, meal_prepared, driver_arrived, consumer_lat, consumer_lng, consumer_address')
      .eq('id', Number(orderId))
      .single()

    if (queryError || !currentOrder) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

    console.log(`[STATE_MACHINE] 订单#${orderId}: 当前status=${currentOrder.status}, meal_prepared=${currentOrder.meal_prepared}, driver_arrived=${currentOrder.driver_arrived}, 角色=${userRole}`)

    // ========== 双线程独立控制逻辑 ==========

    // === 商家线程：meal_prepared ===
    if (meal_prepared === true) {
      if (userRole !== 'merchant') {
        return NextResponse.json({ error: '只有商家可以标记制作完成' }, { status: 403 })
      }
      // 校验商家身份
      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle()

      if (!merchant || merchant.id !== currentOrder.merchant_id) {
        return NextResponse.json({ error: '无权操作此订单，这不是您的店铺订单' }, { status: 403 })
      }

      const { data, error } = await supabase
        .from('orders')
        .update({ meal_prepared: true })
        .eq('id', Number(orderId))
        .select()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      console.log(`[STATE_MACHINE] 商家#${orderId} 制作完成`)
      return NextResponse.json({ success: true, order: data[0] })
    }

    // === 骑手线程：driver_arrived ===
    if (driver_arrived === true) {
      if (userRole !== 'driver') {
        return NextResponse.json({ error: '只有骑手可以确认取货' }, { status: 403 })
      }
      if (currentOrder.driver_id !== userId) {
        return NextResponse.json({ error: '无权操作此订单' }, { status: 403 })
      }

      const { data, error } = await supabase
        .from('orders')
        .update({ driver_arrived: true })
        .eq('id', Number(orderId))
        .eq('driver_id', userId)
        .select()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      console.log(`[STATE_MACHINE] 骑手#${orderId} 已到店取货`)
      return NextResponse.json({ success: true, order: data[0] })
    }

    // === 消费者地址锁定（每单一次，写入后禁止覆盖） ===
    if (consumer_address || consumer_lat || consumer_lng) {
      if (userRole !== 'consumer') {
        return NextResponse.json({ error: '只有消费者可以设置配送地址' }, { status: 403 })
      }

      // 检查是否已锁定（不可覆盖）
      if (currentOrder.consumer_lat && currentOrder.consumer_lng) {
        return NextResponse.json({ error: '该订单的配送地址已锁定，不可修改' }, { status: 400 })
      }

      if (!consumer_address || !consumer_lat || !consumer_lng) {
        return NextResponse.json({ error: '地址名称、经纬度均不能为空' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('orders')
        .update({
          consumer_address,
          consumer_lat: Number(consumer_lat),
          consumer_lng: Number(consumer_lng),
        })
        .eq('id', Number(orderId))
        .select()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      console.log(`[LOCATION_LOCK] 订单#${orderId} 配送地址已锁定:`, consumer_address, consumer_lat, consumer_lng)
      return NextResponse.json({ success: true, order: data[0] })
    }

    // === 共享状态：status 流转 ===
    if (targetStatus) {
      // 校验目标状态是否合法
      if (!Object.keys(STATE_MACHINE).includes(targetStatus)) {
        return NextResponse.json({ error: `无效的状态值: ${targetStatus}` }, { status: 400 })
      }

      // 状态机校验
      const allowedNext = STATE_MACHINE[currentOrder.status]
      if (!allowedNext || !allowedNext.includes(targetStatus)) {
        return NextResponse.json({
          error: `状态跳转被拒绝: 当前状态「${currentOrder.status}」不允许直接变为「${targetStatus}」`,
          currentStatus: currentOrder.status,
        }, { status: 400 })
      }

      // 角色权限校验
      if (targetStatus === 'completed') {
        if (userRole !== 'driver') {
          return NextResponse.json({ error: '只有骑手可以确认送达' }, { status: 403 })
        }
        if (currentOrder.driver_id !== userId) {
          return NextResponse.json({ error: '无权操作此订单' }, { status: 403 })
        }
        // 复合锁校验：送达前必须 meal_prepared && driver_arrived
        if (!currentOrder.meal_prepared || !currentOrder.driver_arrived) {
          return NextResponse.json({
            error: '商家未完成制作或骑手未确认取货，禁止送达！',
            missing: {
              meal_prepared: !currentOrder.meal_prepared,
              driver_arrived: !currentOrder.driver_arrived,
            },
          }, { status: 400 })
        }
      }

      const { data, error } = await supabase
        .from('orders')
        .update({ status: targetStatus })
        .eq('id', Number(orderId))
        .select()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      console.log(`[STATE_MACHINE] 订单#${orderId} status: ${currentOrder.status} → ${targetStatus}`)
      return NextResponse.json({ success: true, order: data[0] })
    }

    return NextResponse.json({ error: '没有指定任何操作' }, { status: 400 })
  } catch (err) {
    console.error('[STATE_MACHINE] 异常:', err)
    return NextResponse.json({ error: '更新订单失败: ' + (err as Error).message }, { status: 500 })
  }
}
