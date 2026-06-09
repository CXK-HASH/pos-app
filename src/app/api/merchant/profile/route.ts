import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/merchant/profile
 * 商家门店位置更新接口
 * 用 Supabase REST API 直连 PATCH 规避 JS Client 的 schema cache
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { merchant_id, shop_address, address, lng, lat } = body
    if (!merchant_id) {
      return NextResponse.json({ success: false, message: '缺少 merchant_id' }, { status: 400 })
    }

    const merchantId = Number(merchant_id)
    const safeLng = lng ? Number(lng) : null
    const safeLat = lat ? Number(lat) : null
    const safeAddress = address || shop_address || ''
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!

    console.log('🏪 [API_MERCHANT_PROFILE] 收到请求:', JSON.stringify(body))

    // 直接调用 PostgREST PATCH endpoint（绕过 JS Client schema cache）
    const endpoint = `${supabaseUrl}/rest/v1/merchants?id=eq.${merchantId}`
    const payload = { address: safeAddress, lng: safeLng, lat: safeLat }

    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const txt = await res.text()
      console.error('❌ [API_MERCHANT_PROFILE] PostgREST 写失败:', res.status, txt)
      return NextResponse.json({ success: false, error: `写入失败: ${txt}` }, { status: 500 })
    }

    console.log('✅ [API_MERCHANT_PROFILE] 坐标写入成功, merchant_id:', merchantId)
    return NextResponse.json({ success: true, message: '门店空间数据同步成功！' })
  } catch (catchErr: any) {
    console.error('🚨 [API_MERCHANT_PROFILE_CRASH] /api/merchant/profile 内部崩塌:', catchErr)
    return NextResponse.json({ success: false, error: catchErr?.message || '未知服务端错误' }, { status: 500 })
  }
}
