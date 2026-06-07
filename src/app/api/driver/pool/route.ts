import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const getServiceKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ''

const getSupabase = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getServiceKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export async function GET() {
  const supabase = getSupabase()

  // 🔧 测试阶段：放宽状态过滤，允许 pending（待支付）也流入抢单池
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .in('status', ['pending', 'paid', 'processing'])
    .is('driver_id', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[POOL_DEBUG] 查询失败:', JSON.stringify(error))
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!orders || orders.length === 0) return NextResponse.json([])

  // 关联商户信息
  const merchantIds = [...new Set(orders.map((o) => o.merchant_id).filter(Boolean))]
  const merchantMap = new Map<number, { name: string; logo_url: string | null }>()

  if (merchantIds.length > 0) {
    const { data: merchants } = await supabase
      .from('merchants')
      .select('id, name, logo_url')
      .in('id', merchantIds)

    merchants?.forEach((m) => merchantMap.set(m.id, { name: m.name, logo_url: m.logo_url }))
  }

  const enriched = orders.map((o) => ({
    ...o,
    total_price: Number(o.total_price), // 确保数字类型
    merchants: o.merchant_id ? merchantMap.get(o.merchant_id) ?? { name: '未知商家', logo_url: null } : { name: '未知商家', logo_url: null },
  }))

  return NextResponse.json(enriched)
}
