'use client'

import { useState, useEffect, useCallback } from 'react'
import MapPicker from '@/components/MapPicker'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type Merchant = {
  id: number
  name: string
  logo_url: string | null
  rating: number
}

type Dish = {
  id: number
  name: string
  merchant_id: number
  dish_category_id: number | null
  price: number
}

type DishCategory = {
  id: number
  name: string
}

type AiRecommend = {
  id: number
  name: string
  dishes: string[]
}

const CATEGORIES = [
  { icon: '🍔', name: '汉堡', color: 'from-red-400 to-rose-500' },
  { icon: '🍜', name: '面食', color: 'from-amber-400 to-orange-500' },
  { icon: '🍲', name: '米饭', color: 'from-emerald-400 to-teal-500' },
  { icon: '☕', name: '奶茶', color: 'from-pink-400 to-purple-500' },
  { icon: '🥟', name: '饺子', color: 'from-sky-400 to-blue-500' },
  { icon: '🥗', name: '轻食', color: 'from-lime-400 to-green-500' },
]

const LOGO_EMOJIS: Record<string, string> = {
  '湘味木桶饭': '🍚',
  '蜜雪冰城': '🍦',
}

export default function CustomerHome() {
  const router = useRouter()
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [allDishes, setAllDishes] = useState<Dish[]>([])
  const [categories, setCategories] = useState<DishCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeCatIdx, setActiveCatIdx] = useState<number | null>(null)

  // 搜索
  const [searchQuery, setSearchQuery] = useState('')
  const [filterText, setFilterText] = useState('')

  // 地址
  const [address, setAddress] = useState('天河城')
  const [coords, setCoords] = useState({ lat: 23.128, lng: 113.262 })
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [toast, setToast] = useState('')

  // 自动定位
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setCoords({ lat, lng })
        if (typeof window !== 'undefined' && (window as any).BMap) {
          const pt = new (window as any).BMap.Point(lng, lat)
          const gc = new (window as any).BMap.Geocoder()
          gc.getLocation(pt, (rs: any) => {
            if (rs?.address) setAddress(rs.address)
          })
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    )
  }, [])

  // AI 抽屉
  const [showAiDrawer, setShowAiDrawer] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiReply, setAiReply] = useState('')
  const [aiRecommendations, setAiRecommendations] = useState<AiRecommend[]>([])
  const [aiHistory, setAiHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([])

  // 路由守卫
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        alert('登录已失效，请重新登录！')
        localStorage.clear()
        sessionStorage.clear()
        window.location.href = '/'
        return
      }
      const role = session.user.user_metadata?.role
      if (role !== 'customer') {
        alert('权限不足！')
        localStorage.clear()
        sessionStorage.clear()
        window.location.href = '/'
        return
      }
    })
  }, [router])

  // 加载数据
  useEffect(() => {
    Promise.all([
      supabase.from('merchants').select('*').order('id', { ascending: true }),
      supabase.from('dishes').select('id, name, price, merchant_id, dish_category_id'),
      supabase.from('dish_categories').select('id, name'),
    ]).then(([merchantRes, dishRes, catRes]) => {
      if (!merchantRes.error && merchantRes.data) setMerchants(merchantRes.data)
      if (!dishRes.error && dishRes.data) setAllDishes(dishRes.data)
      if (!catRes.error && catRes.data) setCategories(catRes.data)
      setIsLoading(false)
    })
  }, [])

  // Toast 自动消失
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // === 过滤逻辑 ===
  // 通过分类名称找对应的 dish_category_id
  const categoryDishIds: number[] | null = (() => {
    if (activeCatIdx === null) return null
    const catName = CATEGORIES[activeCatIdx].name
    // 映射：汉堡→人气热销, 面食→精选主食, 米饭→精选主食, 奶茶→招牌饮品, 饺子→特色小吃, 轻食→特色小吃
    const mapping: Record<string, string[]> = {
      '汉堡': ['人气热销'],
      '面食': ['精选主食'],
      '米饭': ['精选主食'],
      '奶茶': ['招牌饮品'],
      '饺子': ['特色小吃'],
      '轻食': ['特色小吃'],
    }
    const targetNames = mapping[catName] || []
    const targetIds = categories.filter(c => targetNames.includes(c.name)).map(c => c.id)
    return targetIds.length > 0 ? targetIds : null
  })()

  // 搜索/分类 过滤商家
  const filteredMerchants = merchants.filter(m => {
    // 文本过滤
    if (filterText) {
      const q = filterText.toLowerCase()
      const nameMatch = m.name.toLowerCase().includes(q)
      const dishMatch = allDishNames[m.id]?.some(n => n.toLowerCase().includes(q))
      if (!nameMatch && !dishMatch) return false
    }

    // 分类过滤
    if (categoryDishIds) {
      const merchantDishCats = allDishes
        .filter(d => d.merchant_id === m.id)
        .map(d => d.dish_category_id)
      const hasMatch = merchantDishCats.some(cid => cid !== null && categoryDishIds.includes(cid))
      if (!hasMatch) return false
    }

    return true
  })

  // 搜索标量子: 按匹配度排序 (完全匹配店名 > 包含店名 > 菜品匹配)
  const sortedMerchants = [...filteredMerchants].sort((a, b) => {
    if (!filterText) return a.id - b.id
    const q = filterText.toLowerCase()
    const aName = a.name.toLowerCase().includes(q)
    const bName = b.name.toLowerCase().includes(q)
    if (aName && !bName) return -1
    if (!aName && bName) return 1
    return a.id - b.id
  })

  // 每个商家的菜品名称列表
  const allDishNames: Record<number, string[]> = {}
  allDishes.forEach(d => {
    if (!allDishNames[d.merchant_id]) allDishNames[d.merchant_id] = []
    allDishNames[d.merchant_id].push(d.name)
  })

  // === 搜索提交 ===
  const handleSearch = useCallback(() => {
    setFilterText(searchQuery.trim())
  }, [searchQuery])

  // === 地址修改 ===
  const handleAddressConfirm = (addr: string, lat: number, lng: number) => {
    setAddress(addr)
    setCoords({ lat, lng })
    setToast('📍 地址已变更，已为您刷新附近热门外卖')
    setShowAddressModal(false)
  }

  // === AI 智能点餐 ===
  const handleAiAsk = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiReply('')

    const userMsg = aiPrompt.trim()
    setAiHistory(prev => [...prev, { role: 'user', text: userMsg }])
    setAiPrompt('')

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      })
      const data = await res.json()
      const reply = data.text || '没能理解您的需求，请重新描述~'
      setAiReply(reply)
      setAiHistory(prev => [...prev, { role: 'ai', text: reply }])
    } catch {
      const errMsg = '网络异常，请重试'
      setAiReply(errMsg)
      setAiHistory(prev => [...prev, { role: 'ai', text: errMsg }])
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 搜索与定位区 */}
      <div className="sticky top-14 z-40 bg-white/60 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          {/* 地址切换 */}
          <button
            onClick={() => setShowAddressModal(true)}
            className="flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span className="text-orange-500 text-lg">📍</span>
            <span className="font-bold text-slate-800 text-sm">{address}</span>
            <span className="text-slate-300 text-xs">▼</span>
          </button>

          <div className="flex-1 flex">
            <div className="flex-1 flex items-center bg-slate-100 rounded-full px-4 py-2">
              <span className="text-slate-400 text-sm">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="搜索美食、商家..."
                className="ml-2 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none w-full"
              />
            </div>
            <button
              onClick={handleSearch}
              className="ml-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-medium rounded-full shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              搜索
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-slate-800 text-white px-5 py-2.5 rounded-full shadow-lg text-sm animate-[fadeInUp_0.3s_ease-out]">
          {toast}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
        {/* Banner 广告位 */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 rounded-2xl shadow-md p-6 text-white relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-xl"></div>
          <div className="relative z-10">
            <p className="text-3xl mb-1">✨</p>
            <h2 className="text-lg font-bold">DeepSeek 智能食神</h2>
            <p className="text-sm text-orange-100 mt-1 opacity-90">懂你所爱 · AI 推荐专属美食</p>
            <button
              onClick={() => setShowAiDrawer(true)}
              className="mt-3 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium hover:bg-white/30 transition-all"
            >
              立即体验 →
            </button>
          </div>
        </div>

        {/* 金刚区分类 */}
        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-3">🍽️ 吃什么</h3>
          <div className="grid grid-cols-6 gap-3">
            {CATEGORIES.map((cat, i) => (
              <button
                key={i}
                onClick={() => setActiveCatIdx(activeCatIdx === i ? null : i)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-300
                  hover:-translate-y-1 hover:scale-105 hover:shadow-sm
                  ${activeCatIdx === i
                    ? 'bg-gradient-to-br ' + cat.color + ' text-white shadow-md'
                    : 'bg-white text-slate-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
                  }`}
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-xs font-medium">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 商家推荐 */}
        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-3">
            🔥 推荐商家
            <span className="text-slate-400 text-xs font-normal ml-2">
              {filterText || activeCatIdx !== null
                ? sortedMerchants.length > 0
                  ? `找到 ${sortedMerchants.length} 家`
                  : '未找到匹配商家'
                : '附近热门外卖'}
            </span>
          </h3>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-orange-500 border-t-transparent"></div>
              <span className="ml-3 text-slate-400 text-sm">加载中...</span>
            </div>
          ) : sortedMerchants.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-slate-400 text-sm">没有找到匹配的商家，换个关键词试试？</p>
              <button
                onClick={() => { setSearchQuery(''); setFilterText(''); setActiveCatIdx(null) }}
                className="mt-3 px-4 py-2 bg-orange-50 text-orange-600 text-sm rounded-full hover:bg-orange-100 transition-all"
              >
                清除筛选条件
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sortedMerchants.map(m => (
                <Link
                  key={m.id}
                  href={`/merchant/${m.id}`}
                  className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(255,122,0,0.1)] hover:-translate-y-1 transition-all duration-300 group overflow-hidden"
                >
                  <div className="h-2 bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500"></div>
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center text-3xl shrink-0 ring-1 ring-orange-100">
                        {LOGO_EMOJIS[m.name] || '🏪'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-slate-800 group-hover:text-orange-600 transition-colors">
                          {m.name}
                        </h2>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex items-center">
                            {[1,2,3,4,5].map(s => (
                              <span key={s} className={`text-xs ${s <= Math.round(m.rating) ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
                            ))}
                          </div>
                          <span className="text-amber-500 text-sm font-semibold">{m.rating}</span>
                          <span className="text-slate-300 mx-1">·</span>
                          <span className="text-slate-400 text-xs">月售 999+</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-medium rounded-full">满减</span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-medium rounded-full">优惠</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-xs text-slate-400">⏱ 约 30 分钟</span>
                      <span className="text-xs text-slate-400">🚚 配送费 ¥3</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== 百度地图地址选择弹窗 ===== */}
      <MapPicker
        open={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        onConfirm={handleAddressConfirm}
        initialAddress={address}
        initialLat={coords.lat}
        initialLng={coords.lng}
      />

      {/* ===== AI 智能食神抽屉 ===== */}
      {showAiDrawer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowAiDrawer(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl animate-[slideInRight_0.3s_ease-out] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* 抽屉头部 */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <span className="font-bold text-slate-800">DeepSeek 智能食神</span>
                <span className="text-[10px] bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-0.5 rounded-full">AI</span>
              </div>
              <button
                onClick={() => setShowAiDrawer(false)}
                className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-all"
              >
                ✕
              </button>
            </div>

            {/* 对话历史 */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* 初始引导 */}
              {aiHistory.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-4xl mb-3">🤖</p>
                  <p className="text-slate-700 font-bold text-sm">想吃什么？告诉我吧！</p>
                  <p className="text-slate-400 text-xs mt-1">比如「来杯珍珠奶茶」「帮我配一份辣鸡排饭」</p>
                </div>
              )}

              {aiHistory.map((msg, i) => (
                <div key={i}>
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-orange-500 text-white rounded-br-md'
                          : 'bg-slate-100 text-slate-700 rounded-bl-md'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                  {/* AI 推荐商家卡片 — 从纯文本中提取商家名作为快捷链接 */}
                  {msg.role === 'ai' && i === aiHistory.length - 1 && (() => {
                    // 从 AI 回复中提取商家名
                    const names = ['湘味木桶饭','蜜雪冰城','阿叔奶茶']
                    const linkedRes = names
                      .filter(n => msg.text.includes(n))
                      .map(n => ({ name: n, id: n === '湘味木桶饭' ? 5 : n === '蜜雪冰城' ? 6 : 7 }))
                    if (linkedRes.length === 0) return null
                    return (
                      <div className="mt-3 flex gap-2 flex-wrap">
                        {linkedRes.map(r => (
                          <Link
                            key={r.id}
                            href={`/merchant/${r.id}`}
                            onClick={() => setShowAiDrawer(false)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 text-xs font-medium rounded-full hover:bg-orange-100 transition-all"
                          >
                            {LOGO_EMOJIS[r.name] || '🏪'} {r.name} →
                          </Link>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              ))}
              {aiLoading && (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <div className="h-2 w-2 bg-orange-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}></div>
                  <div className="h-2 w-2 bg-orange-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></div>
                  <div className="h-2 w-2 bg-orange-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></div>
                </div>
              )}
            </div>

            {/* 输入区 */}
            <div className="border-t border-slate-100 p-4">
              <div className="flex gap-2">
                <input
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !aiLoading && handleAiAsk()}
                  placeholder="告诉我你想吃什么..."
                  className="flex-1 px-4 py-2.5 bg-slate-50 rounded-xl text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-orange-300 transition-all"
                />
                <button
                  onClick={handleAiAsk}
                  disabled={aiLoading}
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-bold rounded-xl hover:shadow-md disabled:opacity-50 transition-all active:scale-95"
                >
                  {aiLoading ? '...' : '发送'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
