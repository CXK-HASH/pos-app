import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { orderId, status } = body

    if (!orderId || !status) {
      return NextResponse.json({ error: 'orderId 和 status 为必填' }, { status: 400 })
    }

    if (!['shipping', 'completed'].includes(status)) {
      return NextResponse.json({ error: '状态必须为 shipping 或 completed' }, { status: 400 })
    }

    // 验证骑手身份
    const authHeader = request.headers.get('Authorization')
    let userId: string | null = null
    if (authHeader?.startsWith('Bearer ')) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
      userId = user?.id ?? null
    }
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', Number(orderId))
      .eq('driver_id', userId)
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) {
      return NextResponse.json({ error: '无权操作此订单' }, { status: 403 })
    }

    return NextResponse.json({ success: true, order: data[0] })
  } catch (err) {
    return NextResponse.json({ error: '操作失败: ' + (err as Error).message }, { status: 500 })
  }
}
