import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cart, totalPrice, merchantId } = body

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: '购物车不能为空' }, { status: 400 })
    }

    if (typeof totalPrice !== 'number' || totalPrice < 0) {
      return NextResponse.json({ error: '金额无效' }, { status: 400 })
    }

    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('orders')
      .insert([{
        total_price: totalPrice,
        items: cart,
        status: 'pending',
        merchant_id: merchantId || null,
      }])
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, order: data[0] })
  } catch (err) {
    return NextResponse.json(
      { error: '创建订单失败: ' + (err as Error).message },
      { status: 500 }
    )
  }
}
