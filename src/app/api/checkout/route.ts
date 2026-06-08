import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  let body: Record<string, unknown> = {}

  try {
    body = await request.json()
  } catch (e) {
    console.error('[PROD_DEBUG] 后端 JSON 解析失败:', e)
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 })
  }

  console.log('[PROD_DEBUG] 后端实际接收到的原始 Payload:', JSON.stringify(body))

  const { cart, totalPrice, merchantId } = body

  if (!cart || !Array.isArray(cart) || cart.length === 0) {
    console.error('[PROD_DEBUG] 购物车校验失败, cart =', JSON.stringify(cart))
    return NextResponse.json({ error: '购物车不能为空' }, { status: 400 })
  }

  if (typeof totalPrice !== 'number' || totalPrice < 0) {
    console.error('[PROD_DEBUG] 金额校验失败, totalPrice =', totalPrice)
    return NextResponse.json({ error: '金额无效' }, { status: 400 })
  }

  // 强类型转换：确保 merchantId 是数字
  const merchantIdNum = Number(merchantId)

  // 从 Authorization header 解析当前用户
  const authHeader = request.headers.get('Authorization')
  let userId: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    userId = user?.id ?? null
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ''
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 查询商户的地址经纬度快照
  let merchantLat: number | null = null
  let merchantLng: number | null = null
  let merchantAddress: string | null = null
  if (merchantIdNum && !Number.isNaN(merchantIdNum)) {
    const { data: mer } = await supabase
      .from('merchants')
      .select('lat, lng, address, name')
      .eq('id', merchantIdNum)
      .maybeSingle()
    if (mer) {
      merchantLat = mer.lat ? Number(mer.lat) : null
      merchantLng = mer.lng ? Number(mer.lng) : null
      merchantAddress = mer.address || null
    }
  }

  // 消费者地址由前端传入，订单中暂存空间快照以便骑手端展示
  const orderData = {
    total_price: Number(totalPrice),
    items: cart,
    status: 'pending',
    merchant_id: Number.isNaN(merchantIdNum) ? null : merchantIdNum,
    user_id: userId,
    // 空间快照
    merchant_lat: merchantLat,
    merchant_lng: merchantLng,
    merchant_address: merchantAddress,
    // 消费者地址——前端后续可传入，暂留空
    consumer_lat: null,
    consumer_lng: null,
    consumer_address: null,
  }

  console.log('[PROD_DEBUG] 即将写入 orders:', JSON.stringify(orderData))

  const { data, error } = await supabase
    .from('orders')
    .insert([orderData])
    .select()

  if (error) {
    console.error('[PROD_DEBUG] Supabase 写入失败:', JSON.stringify(error))
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[PROD_DEBUG] 订单创建成功:', JSON.stringify(data))
  return NextResponse.json({ success: true, order: data[0] })
}
