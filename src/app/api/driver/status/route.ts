import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const getServiceKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ''

// 骑手操作状态机约束（status 流转）
const DRIVER_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  processing: ['shipping'],
  prepared:   ['shipping'],
  shipping:   ['completed'],
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { orderId, status: targetStatus, driver_arrived } = body

    if (!orderId) {
      return NextResponse.json({ error: 'orderId 不能为空' }, { status: 400 })
    }

    // 验证骑手身份
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

    // 前置断言
    const { data: currentOrder, error: queryError } = await supabase
      .from('orders')
      .select('id, status, driver_id, meal_prepared, driver_arrived')
      .eq('id', Number(orderId))
      .single()

    if (queryError || !currentOrder) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

    // === 骑手线程：driver_arrived ===
    if (driver_arrived === true) {
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
        console.error('[DRIVER_STATE] 更新失败:', JSON.stringify(error))
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      console.log(`[DRIVER_STATE] 骑手#${orderId} 已到店取货`)
      return NextResponse.json({ success: true, order: data[0] })
    }

    // === status 流转 ===
    if (targetStatus) {
      if (!['shipping', 'completed'].includes(targetStatus)) {
        return NextResponse.json({ error: '状态必须为 shipping 或 completed' }, { status: 400 })
      }

      const allowedFrom = DRIVER_ALLOWED_TRANSITIONS[currentOrder.status]
      if (!allowedFrom || !allowedFrom.includes(targetStatus)) {
        return NextResponse.json({
          error: `越权操作：当前订单状态为「${currentOrder.status}」不允许直接变为「${targetStatus}」`,
        }, { status: 400 })
      }

      // 复合锁校验：送达前必须双因子
      if (targetStatus === 'completed') {
        if (!currentOrder.meal_prepared || !currentOrder.driver_arrived) {
          const missing = []
          if (!currentOrder.meal_prepared) missing.push('商家未制作完成')
          if (!currentOrder.driver_arrived) missing.push('骑手未确认取货')
          return NextResponse.json({
            error: `禁止送达：${missing.join('，')}！`,
            meal_prepared: currentOrder.meal_prepared,
            driver_arrived: currentOrder.driver_arrived,
          }, { status: 400 })
        }
      }

      const { data, error } = await supabase
        .from('orders')
        .update({ status: targetStatus })
        .eq('id', Number(orderId))
        .eq('driver_id', userId)
        .select()

      if (error) {
        console.error('[DRIVER_STATE] 更新失败:', JSON.stringify(error))
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      if (!data || data.length === 0) {
        return NextResponse.json({ error: '无权操作此订单' }, { status: 403 })
      }

      console.log(`[DRIVER_STATE] 订单#${orderId}: ${currentOrder.status} → ${targetStatus}`)
      return NextResponse.json({ success: true, order: data[0] })
    }

    return NextResponse.json({ error: '未指定任何操作' }, { status: 400 })
  } catch (err) {
    console.error('[DRIVER_STATE] 异常:', err)
    return NextResponse.json({ error: '操作失败: ' + (err as Error).message }, { status: 500 })
  }
}
