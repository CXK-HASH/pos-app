import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { message } = await req.json()

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ text: '请输入您想吃的食物' }, { status: 400 })
    }

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { text: 'AI 服务未配置，请检查环境变量 DEEPSEEK_API_KEY' },
        { status: 500 }
      )
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'}/chat/completions`,
      {
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
              content:
                '你现在是【小龙虾外卖】平台的AI智能食神管家。你的职责是根据用户的喜好（如不吃辣、想喝甜的、喜欢面食等），热情、口语化地为用户推荐美食。目前全平台入驻商家有：1.【湘味木桶饭】（主营：红烧肉、木桶饭）；2.【蜜雪冰城】（主营：珍珠奶茶、冰淇淋）；3.【阿叔奶茶】（主营：各种招牌饮品）。请根据用户的要求，聪明地引导他们向这三家店点餐，回答不要携带任何 JSON 代码块，只返回纯文本和明确的时间戳引导。',
            },
            { role: 'user', content: message },
          ],
          temperature: 0.7,
        }),
      }
    )

    const data = await response.json()
    const aiReply = data.choices?.[0]?.message?.content || ''

    if (!aiReply) {
      return NextResponse.json({ text: '抱歉，我暂时想不到推荐什么，请再描述一下~' })
    }

    return NextResponse.json({ text: aiReply })
  } catch (error) {
    console.error('DeepSeek 调用失败:', error)
    return NextResponse.json({ text: 'AI 思考超时，请稍后再试' }, { status: 500 })
  }
}
