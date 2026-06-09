import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = getSupabase()
  const { data } = await supabase.auth.getUser(authHeader.slice(7))
  return data?.user?.id ?? null
}

/** GET /api/user/address — 读取用户存的位置 */
export async function GET(request: Request) {
  const uid = await getUserId(request)
  if (!uid) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const supabase = getSupabase()
  const { data } = await supabase
    .from('user_addresses')
    .select('address, lng, lat, adcode')
    .eq('user_id', uid)
    .maybeSingle()

  return NextResponse.json(data || { address: '', lng: 0, lat: 0, adcode: null })
}

/** POST /api/user/address — 保存用户位置 */
export async function POST(request: Request) {
  const uid = await getUserId(request)
  if (!uid) return NextResponse.json({ error: '未登录' }, { status: 401 })

  try {
    const body = await request.json()
    const { address, lng, lat, adcode } = body
    if (!address || !lng || !lat) {
      return NextResponse.json({ error: '缺少 address/lng/lat' }, { status: 400 })
    }

    const supabase = getSupabase()

    // upsert: 每个用户只有一条记录
    const { error } = await supabase
      .from('user_addresses')
      .upsert({
        user_id: uid,
        address: String(address),
        lng: Number(lng),
        lat: Number(lat),
        adcode: adcode ? String(adcode) : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (error) {
      console.error('[USER_ADDRESS_POST] upsert 失败:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
