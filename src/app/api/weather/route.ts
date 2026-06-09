import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const districtId = searchParams.get('district_id') || '410100'

  const ak = process.env.NEXT_PUBLIC_BAIDU_MAP_AK
  if (!ak) {
    return NextResponse.json({ status: -1, message: 'AK 未配置' }, { status: 500 })
  }

  const url = `https://api.map.baidu.com/weather/v1/?district_id=${districtId}&data_type=now&ak=${ak}`

  try {
    const res = await fetch(url)
    const json = await res.json()
    return NextResponse.json(json)
  } catch (err) {
    console.error('[WEATHER_PROXY] 请求异常:', err)
    return NextResponse.json({ status: -1, message: '代理请求失败' }, { status: 502 })
  }
}
