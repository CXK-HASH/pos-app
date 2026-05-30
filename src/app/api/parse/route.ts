import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { url } = await req.json()
    if (!url) {
      return NextResponse.json({ success: false, message: '链接不能为空' }, { status: 400 })
    }

    const mobileHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    }

    // =================【全新升级版：抖音无水印网页解密算法】=================
    if (url.includes('douyin.com')) {
      // 1. 追踪 302 重定向拿到长链接
      const redirectRes = await fetch(url, { headers: mobileHeaders, redirect: 'manual' })
      let longUrl = redirectRes.headers.get('location') || ''

      if (!longUrl) {
        // 兜底：如果没触发 manual 重定向，尝试正常流
        const normalRes = await fetch(url, { headers: mobileHeaders })
        longUrl = normalRes.url
      }

      // 2. 直接对长链接网页发起 fetch 请求，抓取完整的网页 HTML
      const htmlRes = await fetch(longUrl, { headers: mobileHeaders })
      const htmlText = await htmlRes.text()

      // 3. 用高精正则表达式提取抖音注入在网页中的 RENDER_DATA
      const renderDataMatch =
        htmlText.match(/id="RENDER_DATA"\s*type="application\/json">([\s\S]*?)<\/script>/) ||
        htmlText.match(/_SSR_DATA\s*=\s*([\s\S]*?);<\/script>/)

      if (!renderDataMatch || !renderDataMatch[1]) {
        return NextResponse.json({
          success: false,
          message: '抖音风控升级，未能从页面提取到核心元数据，请重试或更换链接',
        })
      }

      // 4. 解码并转为标准 JSON 树
      const decodedData = decodeURIComponent(renderDataMatch[1].trim())
      const jsonData = JSON.parse(decodedData)

      // 5. 按照抖音最新的页面数据 JSON 层级，精准下钻抓取视频地址
      const rootKey = Object.keys(jsonData).find(
        (key) => jsonData[key]?.aweme || jsonData[key]?.videoInfoRes
      )
      const awemeDetail = rootKey
        ? jsonData[rootKey].aweme || jsonData[rootKey].videoInfoRes?.itemInfos
        : null

      if (!awemeDetail || !awemeDetail.video) {
        return NextResponse.json({
          success: false,
          message: '视频详情深度解析失败，解析通道被拒绝',
        })
      }

      const title = awemeDetail.desc || '无标题视频'

      // 获取带水印的原始播放列表
      const urlList =
        awemeDetail.video.playAddr?.urlList || awemeDetail.video.play_addr?.url_list
      if (!urlList || urlList.length === 0) {
        return NextResponse.json({
          success: false,
          message: '未能提取到有效的底层播放流地址',
        })
      }

      const rawPlayUrl = urlList[0]

      // 6. 硬核去水印核心：将地址中的 playwm 替换成 play
      const noWmPlayUrl = rawPlayUrl.replace('playwm', 'play')

      // 7. 伪造手机端再次进行一次 302 追踪，抓到最终 CDN 直链
      const finalRes = await fetch(noWmPlayUrl, { headers: mobileHeaders, redirect: 'manual' })
      const realVideoUrl = finalRes.headers.get('location') || noWmPlayUrl

      return NextResponse.json({
        success: true,
        data: {
          title,
          url: realVideoUrl,
          cover: awemeDetail.video.cover?.urlList?.[0] || '',
          platform: 'douyin',
        },
      })
    }

    // =================【B站视频流解析算法（保持完好）】=================
    if (url.includes('bilibili.com') || url.includes('b23.tv')) {
      let targetUrl = url
      if (url.includes('b23.tv')) {
        const b23Res = await fetch(url, { redirect: 'manual' })
        targetUrl = b23Res.headers.get('location') || url
      }
      const bvMatch = targetUrl.match(/(BV[a-zA-Z0-9]+)/)
      if (!bvMatch || !bvMatch[1]) {
        return NextResponse.json({ success: false, message: '未找到有效的B站BV号' })
      }
      const bvid = bvMatch[1]
      const cidApi = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`
      const cidRes = await fetch(cidApi, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const cidData = await cidRes.json()

      if (cidData.code !== 0) {
        return NextResponse.json({ success: false, message: 'B站视频信息查询失败' })
      }
      const cid = cidData.data.cid
      const title = cidData.data.title

      const playApi = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=32&type=mp4&platform=html5`
      const playRes = await fetch(playApi, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const playData = await playRes.json()

      if (playData.code !== 0 || !playData.data.durl) {
        return NextResponse.json({ success: false, message: 'B站流地址提取失败' })
      }
      return NextResponse.json({
        success: true,
        data: { title, url: playData.data.durl[0].url, cover: cidData.data.pic, platform: 'bilibili' },
      })
    }

    return NextResponse.json({ success: false, message: '未匹配到支持的解析协议' })
  } catch (error: any) {
    console.error('升级版去水印服务崩溃:', error)
    return NextResponse.json(
      { success: false, message: `服务器解析发生崩溃: ${error.message}` },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
