import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const getServiceKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ''

const getSupabase = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getServiceKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// 状态机合法流转表: current_status → [allowed_next_statuses]
const STATE_MACHINE: Record<string, string[]> = {
  pending:     ['paid'],
  paid:        ['processing'],
  processing:  ['prepared'],          // 商家：制作完成
  prepared:    ['shipping'],          // 骑手：已取货配送
  shipping:    ['completed'],         // 骑手：已送达
  completed:   [],                    // 终态
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId, status: targetStatus } = body

    if (!orderId || !targetStatus) {
      return NextResponse.json({ error: 'orderId 和 status 不能为空' }, { status: 400 })
    }

    // 校验目标状态是否合法
    if (!Object.keys(STATE_MACHINE).includes(targetStatus)) {
      return NextResponse.json({ error: `无效的状态值: ${targetStatus}` }, { status: 400 })
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

    const supabase = getSupabase()

    // 1. 先查询当前订单状态（前置断言）
    const { data: currentOrder, error: queryError } = await supabase
      .from('orders')
      .select('id, status, merchant_id, driver_id')
      .eq('id', Number(orderId))
      .single()

    if (queryError || !currentOrder) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

    console.log(`[STATE_MACHINE] 订单#${orderId}: 当前=${currentOrder.status}, 目标=${targetStatus}, 角色=${userRole}`)

    // 2. 状态机校验：当前状态是否允许流转到目标状态
    const allowedNext = STATE_MACHINE[currentOrder.status]
    if (!allowedNext || !allowedNext.includes(targetStatus)) {
      console.error(`[STATE_MACHINE] 状态跳转非法: ${currentOrder.status} → ${targetStatus}`)
      return NextResponse.json({
        error: `状态跳转被拒绝: 当前状态「${currentOrder.status}」不允许直接变为「${targetStatus}」`,
        currentStatus: currentOrder.status,
      }, { status: 400 })
    }

    // 3. 角色权限校验
    if (targetStatus === 'prepared' && userRole !== 'merchant') {
      return NextResponse.json({ error: '只有商家可以标记制作完成' }, { status: 403 })
    }
    if (targetStatus === 'shipping' && userRole !== 'driver') {
      return NextResponse.json({ error: '只有骑手可以确认取货配送' }, { status: 403 })
    }
    if (targetStatus === 'completed' && userRole !== 'driver') {
      return NextResponse.json({ error: '只有骑手可以确认送达' }, { status: 403 })
    }
    if (targetStatus === 'paid' && userRole !== 'consumer') {
      return NextResponse.json({ error: '只有消费者可以确认支付' }, { status: 403 })
    }

    // 4. 商家身份校验：确保是订单所属商家
    if (targetStatus === 'prepared') {
      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle()

      if (!merchant || merchant.id !== currentOrder.merchant_id) {
        return NextResponse.json({ error: '无权操作此订单，这不是您的店铺订单' }, { status: 403 })
      }
    }

    // 5. 骑手身份校验：操作自己的订单
    if ((targetStatus === 'shipping' || targetStatus === 'completed') && currentOrder.driver_id !== userId) {
      return NextResponse.json({ error: '无权操作此订单' }, { status: 403 })
    }

    // 6. 执行状态更新
    const { data, error } = await supabase
      .from('orders')
      .update({ status: targetStatus })
      .eq('id', Number(orderId))
      .select()

    if (error) {
      console.error('[STATE_MACHINE] 更新失败:', JSON.stringify(error))
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[STATE_MACHINE] 订单#${orderId} 状态变更成功: ${currentOrder.status} → ${targetStatus}`)
    return NextResponse.json({ success: true, order: data[0] })
  } catch (err) {
    console.error('[STATE_MACHINE] 异常:', err)
    return NextResponse.json({ error: '更新订单状态失败: ' + (err as Error).message }, { status: 500 })
  }
}
