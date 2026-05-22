import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/admin/dishes — 上架新菜品
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, price, image_url, merchant_id, dish_category_id } = body

    if (!name || typeof price !== 'number' || !merchant_id) {
      return NextResponse.json({ error: 'name/price/merchant_id 为必填' }, { status: 400 })
    }

    const supabase = getAdmin()
    const { data, error } = await supabase
      .from('dishes')
      .insert({ name, price, image_url: image_url || null, merchant_id, dish_category_id: dish_category_id || null })
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, dish: data[0] })
  } catch (err) {
    return NextResponse.json({ error: '上架失败: ' + (err as Error).message }, { status: 500 })
  }
}

// GET /api/admin/dishes — 获取某商家的全部菜品
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const merchantId = searchParams.get('merchant_id')

  if (!merchantId) {
    return NextResponse.json({ error: 'merchant_id 为必填' }, { status: 400 })
  }

  const supabase = getAdmin()
  const { data, error } = await supabase
    .from('dishes')
    .select('*')
    .eq('merchant_id', Number(merchantId))
    .order('id', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
