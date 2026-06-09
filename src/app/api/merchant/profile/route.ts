import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * PUT /api/merchant/profile
 * 商家门店位置更新接口
 * 使用 Supabase JS Client + 新创建的列（address/lng/lat）
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

    console.log('🏪 [API_MERCHANT_PROFILE] 收到请求:', JSON.stringify(body))

    const supabase = getClient()

    const { error } = await supabase
      .from('merchants')
      .update({ address: safeAddress, lng: safeLng, lat: safeLat })
      .eq('id', merchantId)

    if (error) {
      console.error('❌ [API_MERCHANT_PROFILE] 写入失败:', error.message)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    console.log('✅ [API_MERCHANT_PROFILE] 坐标写入成功, merchant_id:', merchantId)
    return NextResponse.json({ success: true, message: '门店空间数据同步成功！' })
  } catch (catchErr: any) {
    console.error('🚨 [API_MERCHANT_PROFILE_CRASH] /api/merchant/profile 内部崩塌:', catchErr)
    return NextResponse.json({ success: false, error: catchErr?.message || '未知服务端错误' }, { status: 500 })
  }
}
