import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PEXELS_KEY = process.env.PEXELS_API_KEY || 'A7rN1A0BX1L72cRaGHKjRupZtiVTgXbhDFcG9DNJIqqmSQe9XE1Q8oAs'

/** GET /api/videos/feed?page=1 — 拉取 Pexels 热门短视频 feed */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = searchParams.get('page') || '1'
  const perPage = searchParams.get('per_page') || '10'

  try {
    const res = await fetch(
      `https://api.pexels.com/videos/popular?per_page=${perPage}&page=${page}&min_width=360&min_height=640`,
      { headers: { Authorization: PEXELS_KEY } }
    )
    if (!res.ok) {
      const txt = await res.text()
      return NextResponse.json({ error: `Pexels ${res.status}: ${txt}` }, { status: 502 })
    }

    const data = await res.json()
    const videos = (data.videos || []).map((v: any) => {
      const files = v.video_files || []
      // 选竖屏 HD 优先
      const best = files
        .filter((f: any) => f.file_type === 'video/mp4')
        .sort((a: any, b: any) => {
          const aScore = (a.quality === 'hd' ? 10 : 0) + (a.height >= 640 ? 5 : 0)
          const bScore = (b.quality === 'hd' ? 10 : 0) + (b.height >= 640 ? 5 : 0)
          return bScore - aScore
        })[0]

      return {
        id: v.id,
        url: best?.link || '',
        width: best?.width || 0,
        height: best?.height || 0,
        duration: v.duration,
        cover: v.image,
        author: v.user?.name || '未知',
        authorUrl: v.user?.url || '',
      }
    }).filter((v: any) => v.url)

    return NextResponse.json({
      videos,
      page: data.page,
      per_page: data.per_page,
      total_results: data.total_results,
      next_page: data.next_page || null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
