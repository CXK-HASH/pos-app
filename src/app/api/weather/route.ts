import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const districtId = searchParams.get('district_id') || '410100'

  const ak = process.env.NEXT_PUBLIC_BAIDU_MAP_AK
  if (!ak) {
    console.error('[WEATHER_PROXY] AK 未配置')
    return NextResponse.json({ status: -1, message: 'AK 未配置' }, { status: 500 })
  }

  const url = `https://api.map.baidu.com/weather/v1/?district_id=${districtId}&data_type=now&ak=${ak}`

  try {
    const res = await fetch(url, {
      headers: {
        'Referer': request.headers.get('origin') || 'https://pos-app-flax.vercel.app',
        'User-Agent': 'Mozilla/5.0 (compatible; PosAppProxy/1.0)',
      },
    })
    const json = await res.json()
    console.log('[WEATHER_PROXY] 百度响应 status:', res.status, '| body.status:', json.status)
    return NextResponse.json(json)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[WEATHER_PROXY] 请求异常:', msg)
    return NextResponse.json({ status: -1, message: '代理请求失败: ' + msg }, { status: 502 })
  }
}
