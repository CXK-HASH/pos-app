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

/** 从 Authorization header 解析用户，查出其绑定的 merchant_id（仅商家有效） */
async function getBoundMerchantId(authHeader: string | null): Promise<number | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
  if (!user?.id) return null

  const supabase = getAdmin()
  const { data } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  return data?.id ?? null
}

// POST /api/admin/dishes — 上架新菜品（只能上架到自己绑定的店铺）
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, price, image_url, merchant_id, dish_category_id } = body

    if (!name || typeof price !== 'number' || !merchant_id) {
      return NextResponse.json({ error: 'name/price/merchant_id 为必填' }, { status: 400 })
    }

    // 权限校验：只能操作自己绑定的店铺
    const boundId = await getBoundMerchantId(request.headers.get('Authorization'))
    if (!boundId || boundId !== Number(merchant_id)) {
      return NextResponse.json({ error: '无权操作此店铺的菜品' }, { status: 403 })
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

// GET /api/admin/dishes — 获取当前商家绑定的店铺的菜品
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const merchantId = searchParams.get('merchant_id')

  if (!merchantId) {
    return NextResponse.json({ error: 'merchant_id 为必填' }, { status: 400 })
  }

  // 权限校验：只能查自己绑定的店铺
  const boundId = await getBoundMerchantId(request.headers.get('Authorization'))
  if (!boundId || boundId !== Number(merchantId)) {
    return NextResponse.json({ error: '无权查看此店铺的菜品' }, { status: 403 })
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
