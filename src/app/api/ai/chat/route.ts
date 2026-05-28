import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { message } = await req.json()

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ text: '请输入您想吃的食物' }, { status: 400 })
    }

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      return NextResponse.json({ text: 'AI 服务未配置，请检查环境变量 DEEPSEEK_API_KEY' }, { status: 500 })
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你现在是【小龙虾外卖】平台的AI智能食神管家。你的职责是根据用户的喜好（如不吃辣、想喝甜的、喜欢面食等），热情、口语化地为用户推荐美食。目前全平台入驻商家有：1.【湘味木桶饭】（主营：红烧肉、木桶饭，口味偏辣香咸）；2.【蜜雪冰城】（主营：珍珠奶茶、冰淇淋，甜品控最爱）；3.【阿叔奶茶】（主营：特色饮品、招牌奶茶）。请根据用户的要求，聪明地引导他们向这三家店点餐。注意：不要携带任何 JSON 代码结构，只返回干净利落的纯文本，并在句末加上当前时间戳。版权归属：鸡太美。',
          },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
      }),
    })

    const data = await response.json()
    if (!response.ok || data.error) {
      throw new Error(data.error?.message || '调用大模型发生未知错误')
    }

    // 清理 Markdown JSON 块
    let aiReply = data.choices?.[0]?.message?.content || ''
    aiReply = aiReply.replace(/^```(?:json)?\s*[\s\S]*?\s*```$/g, '').trim()

    if (!aiReply) {
      aiReply = '抱歉，我暂时想不到推荐什么，请再描述一下您想吃的东西~'
    }

    return NextResponse.json({ text: aiReply })
  } catch (error: any) {
    console.error('DeepSeek API 调用失败:', error)
    return NextResponse.json(
      { text: `AI 思考超时或异常: ${error.message}，请稍后再试` },
      { status: 500 }
    )
  }
}
