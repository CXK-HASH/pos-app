import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { url } = await req.json()
    if (!url) {
      return NextResponse.json({ success: false, message: '链接不能为空' }, { status: 400 })
    }

    // 伪造手机端 Chrome 浏览器的 User-Agent
    const mobileHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      'Upgrade-Insecure-Requests': '1',
    }

    // =================【分支一：抖音去水印核心算法】=================
    if (url.includes('douyin.com')) {
      // 1. 追踪 302 重定向，获取包含 itemId 的长链接
      const redirectRes = await fetch(url, {
        headers: mobileHeaders,
        redirect: 'manual',
      })
      const longUrl = redirectRes.headers.get('location') || ''

      // 正则提取 video_id
      const idMatch = longUrl.match(/video\/(\d+)/)
      if (!idMatch || !idMatch[1]) {
        return NextResponse.json({
          success: false,
          message: '无法解析抖音视频ID，请检查链接是否有效',
        })
      }
      const videoId = idMatch[1]

      // 2. 请求抖音视频详情接口
      const detailApi = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${videoId}`
      const detailRes = await fetch(detailApi, { headers: mobileHeaders })
      const detailData = await detailRes.json()

      if (!detailData.item_list || detailData.item_list.length === 0) {
        return NextResponse.json({
          success: false,
          message: '抖音视频信息获取失败，可能已被原作者删除',
        })
      }

      const videoInfo = detailData.item_list[0]
      const title =
        videoInfo.share_info?.share_title || videoInfo.desc || '无标题视频'

      // 3. 核心：playwm → play 去水印
      const wmPlayUrl = videoInfo.video.play_addr.url_list[0]
      const noWmPlayUrl = wmPlayUrl.replace('playwm', 'play')

      // 4. 追踪 302 拿到最终 CDN 直链
      const finalCdnRes = await fetch(noWmPlayUrl, {
        headers: mobileHeaders,
        redirect: 'manual',
      })
      const realVideoUrl = finalCdnRes.headers.get('location') || noWmPlayUrl

      return NextResponse.json({
        success: true,
        data: {
          title: title,
          url: realVideoUrl,
          cover: videoInfo.video.cover?.url_list?.[0] || '',
          platform: 'douyin',
        },
      })
    }

    // =================【分支二：B站视频流解析算法】=================
    if (url.includes('bilibili.com') || url.includes('b23.tv')) {
      // 1. 追踪 B 站短链重定向
      let targetUrl = url
      if (url.includes('b23.tv')) {
        const b23Res = await fetch(url, { redirect: 'manual' })
        targetUrl = b23Res.headers.get('location') || url
      }

      // 2. 提取 BV 号
      const bvMatch = targetUrl.match(/(BV[a-zA-Z0-9]+)/)
      if (!bvMatch || !bvMatch[1]) {
        return NextResponse.json({
          success: false,
          message: '未能在链接中找到有效的B站BV号',
        })
      }
      const bvid = bvMatch[1]

      // 3. 获取视频 cid
      const cidApi = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`
      const cidRes = await fetch(cidApi, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const cidData = await cidRes.json()

      if (cidData.code !== 0) {
        return NextResponse.json({
          success: false,
          message: 'B站视频基本信息查询失败',
        })
      }
      const cid = cidData.data.cid
      const title = cidData.data.title

      // 4. 获取播放流地址 (qn=32 → 480P/720P 免费流)
      const playApi = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=32&type=mp4&platform=html5`
      const playRes = await fetch(playApi, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const playData = await playRes.json()

      if (playData.code !== 0 || !playData.data?.durl) {
        return NextResponse.json({
          success: false,
          message: 'B站视频播放流地址提取失败',
        })
      }

      const realVideoUrl = playData.data.durl[0].url

      return NextResponse.json({
        success: true,
        data: {
          title: title,
          url: realVideoUrl,
          cover: cidData.data.pic || '',
          platform: 'bilibili',
        },
      })
    }

    return NextResponse.json({
      success: false,
      message: '所输入的链接未匹配到任何已支持的爬虫解析协议',
    })
  } catch (error: any) {
    console.error('后端去水印解析核心服务异常:', error)
    return NextResponse.json(
      { success: false, message: `服务器解析发生崩溃: ${error.message}` },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
