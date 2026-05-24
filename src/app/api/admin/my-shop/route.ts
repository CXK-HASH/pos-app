import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const ADMIN_SUPABASE = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

async function getUserId(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = ADMIN_SUPABASE()
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7))
  return user?.id ?? null
}

// GET /api/admin/my-shop — 查询当前商家是否已有店铺
export async function GET(request: Request) {
  const userId = await getUserId(request.headers.get('Authorization'))
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const supabase = ADMIN_SUPABASE()
  const { data, error } = await supabase
    .from('merchants')
    .select('id, name, logo_url, owner_id')
    .eq('owner_id', userId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data) return NextResponse.json({ hasShop: false })
  return NextResponse.json({ hasShop: true, shop: data })
}

// POST /api/admin/my-shop — 新商家创建店铺
export async function POST(request: Request) {
  try {
    const userId = await getUserId(request.headers.get('Authorization'))
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const body = await request.json()
    const { shopName, logoUrl } = body

    if (!shopName || !shopName.trim()) {
      return NextResponse.json({ error: '店铺名称不能为空' }, { status: 400 })
    }

    const supabase = ADMIN_SUPABASE()

    // 先检查是否已有店铺，防止重复创建
    const { data: existing } = await supabase
      .from('merchants')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: '您已拥有店铺，无需重复创建' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('merchants')
      .insert({
        name: shopName.trim(),
        logo_url: logoUrl?.trim() || null,
        owner_id: userId,
      })
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, shop: data[0] })
  } catch (err) {
    return NextResponse.json({ error: '创建失败: ' + (err as Error).message }, { status: 500 })
  }
}
