import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const merchantId = searchParams.get('merchant_id')
  const dishCategoryId = searchParams.get('dish_category_id')

  const supabase = getSupabase()
  let query = supabase.from('dishes').select('*')

  if (merchantId) {
    query = query.eq('merchant_id', Number(merchantId))
  }

  if (dishCategoryId) {
    query = query.eq('dish_category_id', Number(dishCategoryId))
  }

  const { data, error } = await query.order('id', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
