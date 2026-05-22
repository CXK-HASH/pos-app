import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { orderId, driverId } = body

    if (!orderId || !driverId) {
      return NextResponse.json({ error: 'orderId 和 driverId 为必填' }, { status: 400 })
    }

    // 从 auth header 验证骑手身份
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

    // 并发安全抢单：WHERE driver_id IS NULL
    const { data, error } = await supabase
      .from('orders')
      .update({ driver_id: userId, status: 'processing' })
      .eq('id', Number(orderId))
      .is('driver_id', null)
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) {
      return NextResponse.json({ error: '订单已被抢走' }, { status: 409 })
    }

    return NextResponse.json({ success: true, order: data[0] })
  } catch (err) {
    return NextResponse.json({ error: '抢单失败: ' + (err as Error).message }, { status: 500 })
  }
}
