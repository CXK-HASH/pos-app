import { NextResponse } from 'next/server'

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

const VALID_TAGS = ['人气热销', '精选主食', '特色小吃', '招牌饮品']

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { text } = body

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: '请输入点餐描述' }, { status: 400 })
    }

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      console.error('DEEPSEEK_API_KEY 未设置')
      return NextResponse.json({ tags: [], analysis: '' })
    }

    const systemPrompt = `你是一个专业的外卖语义分析助手。请分析用户想吃的食物诉求，从以下固定的店内分类中，挑选出最符合用户需求的【1个或多个】分类名称：['人气热销', '精选主食', '特色小吃', '招牌饮品']。

请严格按照以下 JSON 格式返回，不要包含任何 markdown 标记（如 \`\`\`json）、换行符或额外解释：
{"tags": ["精选主食", "招牌饮品"], "analysis": "用户提到了想吃饭和喝饮料"}`

    const response = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text.trim() },
        ],
        max_tokens: 150,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('DeepSeek API error:', response.status, errText)
      return NextResponse.json({ tags: [], analysis: '' })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // 解析 JSON 响应
    let parsed: { tags: string[]; analysis: string }
    try {
      parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''))
    } catch {
      console.error('DeepSeek 返回格式异常:', content)
      return NextResponse.json({ tags: [], analysis: '' })
    }

    // 校验并过滤 tags 中的合法值
    const validTags = (parsed.tags || []).filter((t: string) => VALID_TAGS.includes(t))

    return NextResponse.json({
      tags: validTags,
      analysis: parsed.analysis || '',
    })
  } catch (err) {
    console.error('AI classify error:', err)
    // 异常时安全 fallback
    return NextResponse.json({ tags: [], analysis: '' })
  }
}

export const dynamic = 'force-dynamic'
