import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/merchant/profile
 * 商家门店位置更新接口
 * 使用 SERVICE_ROLE_KEY 通过 Supabase REST API 直接执行，避免 PostgREST schema cache 问题
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { merchant_id, shop_address, address, lng, lat, adcode } = body

    if (!merchant_id) {
      return NextResponse.json({ success: false, message: '缺少 merchant_id' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
    const merchantId = Number(merchant_id)
    const safeLng = lng ? Number(lng) : null
    const safeLat = lat ? Number(lat) : null
    const safeAddress = address || shop_address || null

    console.log('🏪 [API_MERCHANT_PROFILE] 收到请求:', JSON.stringify(body))

    // 直接用 REST API PATCH，不走 JS client 的 schema cache
    const resp = await fetch(`${supabaseUrl}/rest/v1/merchants?id=eq.${merchantId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        address: safeAddress,
        lng: safeLng,
        lat: safeLat,
      }),
    })

    if (!resp.ok) {
      const text = await resp.text()
      console.error('❌ [API_MERCHANT_PROFILE] REST API 写入失败:', resp.status, text)
      return NextResponse.json({ success: false, error: `写入失败 (${resp.status}): ${text}` }, { status: 500 })
    }

    console.log('✅ [API_MERCHANT_PROFILE] 门店坐标写入成功, merchant_id:', merchantId)
    return NextResponse.json({ success: true, message: '门店空间数据同步成功！' })
  } catch (catchErr: any) {
    console.error('🚨 [API_MERCHANT_PROFILE_CRASH] /api/merchant/profile 内部崩塌:', catchErr)
    return NextResponse.json({ success: false, error: catchErr?.message || '未知服务端错误' }, { status: 500 })
  }
}
