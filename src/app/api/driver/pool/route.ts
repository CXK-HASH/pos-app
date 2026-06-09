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

  /** Haversine 距离（km） */
  function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat/2)**2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2)**2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  /** 配送费：起步 1km=2 元，之后每 0.5km + 1 元 */
  function calcDriverFee(km: number): number {
    if (km <= 0) return 2
    return 2 + Math.ceil(Math.max(0, km - 1) / 0.5)
  }

  const enriched = orders.map((o) => {
    const merchant = o.merchant_id ? merchantMap.get(o.merchant_id) : undefined
    const mLat = o.merchant_lat ?? merchant?.lat ?? null
    const mLng = o.merchant_lng ?? merchant?.lng ?? null
    const cLat = o.consumer_lat ?? null
    const cLng = o.consumer_lng ?? null

    // 预估配送费（实时计算，与抢单时的逻辑一致）
    let estimatedFee = 2
    if (mLat && mLng && cLat && cLng) {
      const dist = calcDistance(Number(mLat), Number(mLng), Number(cLat), Number(cLng))
      estimatedFee = calcDriverFee(dist)
    }

    return {
      ...o,
      total_price: Number(o.total_price),
      driver_fee: estimatedFee,
      merchant_address: o.merchant_address || merchant?.address || null,
      merchant_lat: mLat,
      merchant_lng: mLng,
      merchant_name: merchant?.name || '未知商家',
    }
  })

  return NextResponse.json(enriched)
}
