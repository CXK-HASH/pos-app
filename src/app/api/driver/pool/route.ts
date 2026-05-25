import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .in('status', ['paid', 'processing'])
    .is('driver_id', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!orders || orders.length === 0) return NextResponse.json([])

  // 手动补充商家信息
  const merchantIds = [...new Set(orders.map(o => o.merchant_id))]
  const { data: merchants } = await supabase
    .from('merchants')
    .select('id, name, logo_url')
    .in('id', merchantIds)

  const merchantMap = new Map(merchants?.map(m => [m.id, { name: m.name, logo_url: m.logo_url }]) ?? [])

  const enriched = orders.map(o => ({
    ...o,
    merchants: merchantMap.get(o.merchant_id) ?? { name: '未知商家', logo_url: null },
  }))

  return NextResponse.json(enriched)
}
