import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const getAdminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

/**
 * PUT /api/merchant/profile
 * 商家门店位置更新接口
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    console.log('🏪 [API_MERCHANT_PROFILE] 收到请求:', JSON.stringify(body))

    const { merchant_id, shop_address, address, lng, lat, adcode } = body

    if (!merchant_id) {
      return NextResponse.json({ success: false, message: '缺少核心 merchant_id' }, { status: 400 })
    }

    const supabase = getAdminClient()

    const updateFields: Record<string, any> = {}
    if (shop_address !== undefined) updateFields.shop_address = shop_address
    if (address !== undefined) updateFields.address = address
    if (lng !== undefined) updateFields.lng = lng ? Number(lng) : null
    if (lat !== undefined) updateFields.lat = lat ? Number(lat) : null
    if (adcode !== undefined) updateFields.adcode = adcode || null

    console.log('🏪 [API_MERCHANT_PROFILE] 执行更新:', JSON.stringify(updateFields))

    const { error } = await supabase
      .from('merchants')
      .update(updateFields)
      .eq('id', Number(merchant_id))

    if (error) {
      console.error('❌ [API_MERCHANT_PROFILE] Supabase 写入失败:', error.message)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    console.log('✅ [API_MERCHANT_PROFILE] 门店坐标写入成功, merchant_id:', merchant_id)
    return NextResponse.json({ success: true, message: '门店空间数据同步成功！' })
  } catch (catchErr: any) {
    console.error('🚨 [API_MERCHANT_PROFILE_CRASH] /api/merchant/profile 内部崩塌:', catchErr)
    return NextResponse.json({ success: false, error: catchErr?.message || '未知服务端内核错误' }, { status: 500 })
  }
}
