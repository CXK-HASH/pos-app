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

  // 关联商户信息（补充地址等）
  const merchantIds = [...new Set(orders.map((o) => o.merchant_id).filter(Boolean))]
  const merchantMap = new Map<number, { name: string; address: string | null; lat: number | null; lng: number | null }>()

  if (merchantIds.length > 0) {
    const { data: merchants } = await supabase
      .from('merchants')
      .select('id, name, address, lat, lng')
      .in('id', merchantIds)

    merchants?.forEach((m) =>
      merchantMap.set(m.id, { name: m.name, address: m.address || null, lat: m.lat ? Number(m.lat) : null, lng: m.lng ? Number(m.lng) : null })
    )
  }

  const enriched = orders.map((o) => {
    const merchant = o.merchant_id ? merchantMap.get(o.merchant_id) : undefined
    return {
      ...o,
      total_price: Number(o.total_price),
      // 如果订单还没空间快照，从 merchants 表补
      merchant_address: o.merchant_address || merchant?.address || null,
      merchant_lat: o.merchant_lat ?? merchant?.lat ?? null,
      merchant_lng: o.merchant_lng ?? merchant?.lng ?? null,
      merchant_name: merchant?.name || '未知商家',
      // consumer_address 由前端提交时写入
    }
  })

  return NextResponse.json(enriched)
}
