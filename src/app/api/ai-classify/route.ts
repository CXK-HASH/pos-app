import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { text, merchants, dishes } = body

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: '请输入点餐描述' }, { status: 400 })
    }

    // 获取当前所有菜品和商家信息
    let merchantList = merchants
    let dishList = dishes
    if (!merchantList) {
      const { data: m } = await supabase.from('merchants').select('id, name, rating')
      merchantList = m || []
    }
    if (!dishList) {
      const { data: d } = await supabase.from('dishes').select('id, name, merchant_id, price')
      dishList = d || []
    }

    // 构建商店菜单文本供 AI 分析
    const menuText = (merchantList as any[]).map((m: any) => {
      const mDishes = (dishList as any[]).filter((d: any) => d.merchant_id === m.id)
      return `商家「${m.name}」(id:${m.id}, 评分:${m.rating}) 的菜品: ${mDishes.map((d: any) => `${d.name} ¥${d.price}`).join(', ')}`
    }).join('\n')

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      console.error('DEEPSEEK_API_KEY 未设置')
      return NextResponse.json({ reply: 'AI 服务未配置，请稍后再试' })
    }

    const systemPrompt = `你是一个专业的外卖推荐助手。以下是当前可点餐的商家和菜品信息：

${menuText}

请分析用户的点餐需求，从以上商家和菜品中推荐最匹配的选项。
请严格按照以下 JSON 格式返回（不要 markdown 标记或额外文字）：
{"merchants": [{"id": <商家id>, "name": "<商家名>", "dishes": ["<菜品名1>", "<菜品名2>"]}], "reply": "用口语化的方式告知用户推荐了哪些商家和菜品，一共几句话就好"}

- merchants 数组：推荐 1~3 个最符合条件的商家及其对应菜品
- reply 字段：一段自然语言回答，让用户感觉是 AI 在对话`

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
        max_tokens: 500,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('DeepSeek API error:', response.status, errText)
      return NextResponse.json({ reply: '抱歉，AI 暂时无法响应，请稍后重试' })
    }

    const data = await response.json()
    let content = data.choices?.[0]?.message?.content || ''

    // 解析 JSON 响应
    let parsed: { merchants: { id: number; name: string; dishes: string[] }[]; reply: string }
    try {
      content = content.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
      parsed = JSON.parse(content)
    } catch {
      console.error('DeepSeek 返回格式异常:', content)
      return NextResponse.json({ merchants: [], reply: content })
    }

    // 校验 merchants 中的 id 必须存在于数据库
    const validIds = new Set((merchantList as any[]).map((m: any) => m.id))
    const validMerchants = (parsed.merchants || []).filter((m: any) => validIds.has(m.id))

    return NextResponse.json({
      merchants: validMerchants,
      reply: parsed.reply || '已为您推荐了合适的商家~',
    })
  } catch (err) {
    console.error('AI classify error:', err)
    return NextResponse.json({ merchants: [], reply: '网络异常，请重试' })
  }
}

export const dynamic = 'force-dynamic'
