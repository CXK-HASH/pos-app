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

/** 从 Authorization header 解析并返回绑定的 merchant_id */
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
  const { data } = await supabase.from('merchants').select('id').eq('owner_id', user.id).maybeSingle()
  return data?.id ?? null
}

// PUT /api/admin/dishes/[id] — 修改菜品（仅限自己店铺的菜品）
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, price, image_url, dish_category_id } = body

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (price !== undefined) updates.price = price
    if (image_url !== undefined) updates.image_url = image_url
    if (dish_category_id !== undefined) updates.dish_category_id = dish_category_id

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 })
    }

    // 校验：先查出菜品归属的 merchant_id
    const boundId = await getBoundMerchantId(request.headers.get('Authorization'))
    const supabase = getAdmin()
    const { data: dish } = await supabase.from('dishes').select('merchant_id').eq('id', Number(id)).single()
    if (!dish) return NextResponse.json({ error: '菜品不存在' }, { status: 404 })
    if (!boundId || boundId !== dish.merchant_id) {
      return NextResponse.json({ error: '无权修改此店铺的菜品' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('dishes')
      .update(updates)
      .eq('id', Number(id))
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, dish: data[0] })
  } catch (err) {
    return NextResponse.json({ error: '修改失败: ' + (err as Error).message }, { status: 500 })
  }
}

// DELETE /api/admin/dishes/[id] — 删除菜品（仅限自己店铺的菜品）
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // 校验归属
    const boundId = await getBoundMerchantId(request.headers.get('Authorization'))
    const supabase = getAdmin()
    const { data: dish } = await supabase.from('dishes').select('merchant_id').eq('id', Number(id)).single()
    if (!dish) return NextResponse.json({ error: '菜品不存在' }, { status: 404 })
    if (!boundId || boundId !== dish.merchant_id) {
      return NextResponse.json({ error: '无权删除此店铺的菜品' }, { status: 403 })
    }

    const { error, count } = await supabase
      .from('dishes')
      .delete({ count: 'exact' })
      .eq('id', Number(id))

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (count === 0) return NextResponse.json({ error: '菜品不存在' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: '删除失败: ' + (err as Error).message }, { status: 500 })
  }
}
