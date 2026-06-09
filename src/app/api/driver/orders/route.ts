import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const getServiceKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET(request: Request) {
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

  // 已接的订单：包括 pending（刚接入还未推进）、processing、shipping
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('driver_id', userId)
    .in('status', ['pending', 'processing', 'shipping'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[DRIVER_ORDERS_DEBUG] 查询失败:', JSON.stringify(error))
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 兜底：返回空数组而不是 null
  const safeData = (data || []).map((o) => ({
    ...o,
    total_price: Number(o.total_price),
    driver_fee: Number(o.driver_fee || 0),
  }))

  return NextResponse.json(safeData)
}
