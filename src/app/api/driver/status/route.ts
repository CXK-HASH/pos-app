import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const getServiceKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ''

// 骑手操作的状态机约束
const DRIVER_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  prepared: ['shipping'],   // 商家做好 → 骑手取货配送
  shipping: ['completed'],  // 配送中  → 已送达
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { orderId, status: targetStatus } = body

    if (!orderId || !targetStatus) {
      return NextResponse.json({ error: 'orderId 和 status 为必填' }, { status: 400 })
    }

    if (!['shipping', 'completed'].includes(targetStatus)) {
      return NextResponse.json({ error: '状态必须为 shipping 或 completed' }, { status: 400 })
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

    // === 前置断言：状态机校验 ===
    const { data: currentOrder, error: queryError } = await supabase
      .from('orders')
      .select('id, status, driver_id')
      .eq('id', Number(orderId))
      .single()

    if (queryError || !currentOrder) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

    // 检查当前状态是否允许流转到目标状态
    const allowedFrom = DRIVER_ALLOWED_TRANSITIONS[currentOrder.status]
    if (!allowedFrom || !allowedFrom.includes(targetStatus)) {
      console.error(`[DRIVER_STATE] 越权操作: 订单#${orderId} 当前=${currentOrder.status}, 试图=${targetStatus}`)
      return NextResponse.json({
        error: `商家未完成制作或骑手未确认取货，禁止执行「${targetStatus}」操作！当前订单状态为「${currentOrder.status}」`,
      }, { status: 400 })
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
  } catch (err) {
    console.error('[DRIVER_STATE] 异常:', err)
    return NextResponse.json({ error: '操作失败: ' + (err as Error).message }, { status: 500 })
  }
}
