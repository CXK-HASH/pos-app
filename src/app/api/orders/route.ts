import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const getServiceKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  let userId: string | null = null
  let userRole: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      getServiceKey(),
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
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

  console.log(`[ORDERS_API] userId=${userId}, role=${userRole}`)

  try {
    let data: unknown[] = []

    if (userRole === 'merchant') {
      // === 商家：查询属于自己店铺的订单 ===
      // 先查商家绑定的 merchant_id
      const { data: merchant } = await supabase
        .from('merchants')
        .select('id, name')
        .eq('owner_id', userId)
        .maybeSingle()

      if (merchant) {
        const merchantId = merchant.id
        console.log(`[ORDERS_API] 商家模式, merchant_id=${merchantId}`)

        const result = await supabase
          .from('orders')
          .select('*')
          .eq('merchant_id', merchantId)
          .order('created_at', { ascending: false })

        if (result.error) throw result.error
        data = result.data || []
      } else {
        // 商家还没绑定店铺
        data = []
      }
    } else if (userRole === 'driver') {
      // === 骑手：查询自己已接的订单 ===
      console.log(`[ORDERS_API] 骑手模式`)

      const result = await supabase
        .from('orders')
        .select('*')
        .eq('driver_id', userId)
        .order('created_at', { ascending: false })

      if (result.error) throw result.error
      data = result.data || []
    } else {
      // === 消费者：查询自己下的订单 ===
      console.log(`[ORDERS_API] 消费者模式`)

      const result = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (result.error) throw result.error
      data = result.data || []
    }

    // 统一转换数字类型
    const safeData = data.map((o: unknown) => {
      const record = o as Record<string, unknown>
      return { ...record, total_price: Number(record.total_price) }
    })

    return NextResponse.json({ orders: safeData, role: userRole })
  } catch (err) {
    console.error('[ORDERS_API] 查询失败:', err)
    return NextResponse.json({ error: (err as Error).message, orders: [], role: userRole }, { status: 500 })
  }
}
