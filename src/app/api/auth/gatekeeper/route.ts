import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录', redirectTo: '/login' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7))
    if (!user) {
      return NextResponse.json({ error: '用户不存在', redirectTo: '/login' }, { status: 401 })
    }

    const role = user.user_metadata?.role

    switch (role) {
      case 'customer':
        return NextResponse.json({ role, redirectTo: '/' })

      case 'driver':
        return NextResponse.json({ role, redirectTo: '/driver/dashboard' })

      case 'merchant': {
        // 查是否有绑定店铺
        const { data: shop } = await supabase
          .from('merchants')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (shop) {
          return NextResponse.json({ role, redirectTo: '/admin/dashboard' })
        } else {
          return NextResponse.json({ role, redirectTo: '/admin/select-brand' })
        }
      }

      default:
        // 未知角色或未设置
        return NextResponse.json({ role: null, redirectTo: '/' })
    }
  } catch (err) {
    return NextResponse.json({ error: '网关错误', redirectTo: '/' }, { status: 500 })
  }
}
