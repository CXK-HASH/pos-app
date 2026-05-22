'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Merchant = { id: number; name: string }
type Category = { id: number; name: string }
type Dish = { id: number; name: string; price: number; image_url: string | null; merchant_id: number; dish_category_id: number | null }

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [dishes, setDishes] = useState<Dish[]>([])

  // 表单状态
  const [formName, setFormName] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formImage, setFormImage] = useState('')
  const [formCategory, setFormCategory] = useState<number | ''>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const sessionHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('未登录')
    return { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/login'); return }

      const role = session.user.user_metadata?.role
      if (role !== 'merchant') {
        alert('权限不足，只有商家可访问此页面！')
        router.push('/')
        return
      }

      setUser({ id: session.user.id, email: session.user.email || '' })

      // 获取绑定的店铺 + 分类
      const hdrs = await sessionHeaders()
      const [merchantRes, catRes] = await Promise.all([
        fetch('/api/admin/merchant-info', { headers: hdrs }),
        fetch('/api/dish-categories'),
      ])

      const merchantData = await merchantRes.json()
      const cats = await catRes.json()

      setCategories(Array.isArray(cats) ? cats : [])

      if (merchantData?.merchant) {
        setMerchant(merchantData.merchant)
        // 自动加载菜品
        const dishRes = await fetch(`/api/admin/dishes?merchant_id=${merchantData.merchant.id}`, { headers: hdrs })
        const dishData = await dishRes.json()
        setDishes(Array.isArray(dishData) ? dishData : [])
      }
    })()
  }, [router])

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleAddDish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formPrice || !merchant) return

    setIsSubmitting(true)
    try {
      const headers = await sessionHeaders()
      const res = await fetch('/api/admin/dishes', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: formName.trim(),
          price: Number(formPrice),
          image_url: formImage.trim() || null,
          merchant_id: merchant.id,
          dish_category_id: formCategory || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showMessage('success', `✅ "${formName}" 已上架`)
        setFormName('')
        setFormPrice('')
        setFormImage('')
        setFormCategory('')
        const r = await fetch(`/api/admin/dishes?merchant_id=${merchant.id}`, { headers })
        setDishes(await r.json())
      } else {
        showMessage('error', '❌ ' + data.error)
      }
    } catch {
      showMessage('error', '❌ 上架失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditPrice = async (dishId: number) => {
    if (!editPrice || isNaN(Number(editPrice))) return
    try {
      const headers = await sessionHeaders()
      const res = await fetch(`/api/admin/dishes/${dishId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ price: Number(editPrice) }),
      })
      const data = await res.json()
      if (data.success) {
        showMessage('success', `✅ 价格已更新`)
        setEditingId(null)
        setEditPrice('')
        const r = await fetch(`/api/admin/dishes?merchant_id=${merchant!.id}`, { headers })
        setDishes(await r.json())
      } else {
        showMessage('error', '❌ ' + data.error)
      }
    } catch {
      showMessage('error', '❌ 修改失败')
    }
  }

  const handleDelete = async (dishId: number, dishName: string) => {
    if (!confirm(`确定要下架「${dishName}」吗？`)) return
    try {
      const headers = await sessionHeaders()
      const res = await fetch(`/api/admin/dishes/${dishId}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (data.success) {
        showMessage('success', `🗑️ "${dishName}" 已下架`)
        setDishes(prev => prev.filter(d => d.id !== dishId))
      } else {
        showMessage('error', '❌ ' + data.error)
      }
    } catch {
      showMessage('error', '❌ 删除失败')
    }
  }

  if (!user || !merchant) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-gray-400 gap-2">
        {user ? <span>⏳ 加载店铺信息...</span> : <span>加载中...</span>}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* 顶栏 */}
      <header className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold text-lg">🍽️ 小龙虾外卖 · 商家控制台</span>
            <span className="text-orange-400 text-sm font-medium hidden sm:inline">🏪 {merchant.name}</span>
            <span className="text-gray-500 text-xs hidden lg:inline">| {user.email}</span>
          </div>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
            className="px-4 py-1.5 text-sm bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors"
          >
            退出
          </button>
        </div>
      </header>

      {/* Toast */}
      {message && (
        <div className="max-w-6xl mx-auto px-6 mt-5">
          <div className={`px-4 py-2 rounded-xl text-sm ${message.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
            {message.text}
          </div>
        </div>
      )}

      {/* 主体：左表单 + 右列表 */}
      <div className="max-w-6xl mx-auto px-6 py-5 pb-10 flex gap-6 flex-col lg:flex-row">
        {/* 左：上架表单 */}
        <div className="lg:w-[40%]">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-white font-semibold text-lg mb-1">✨ 上架新菜品</h2>
            <p className="text-gray-500 text-xs mb-5">为 {merchant.name} 添加新菜品</p>

            <form onSubmit={handleAddDish} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">菜品名称 *</label>
                <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="如：麻婆豆腐饭" required
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-600" />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">价格 *</label>
                <input type="number" step="0.01" value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="如：25.00" required
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-600" />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">图片链接（可选）</label>
                <input value={formImage} onChange={e => setFormImage(e.target.value)} placeholder="https://..."
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-600" />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">菜品分类</label>
                <select value={formCategory} onChange={e => setFormCategory(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-orange-600">
                  <option value="">不选择</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button type="submit" disabled={isSubmitting}
                className="w-full py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]">
                {isSubmitting ? '上架中...' : '确认上架'}
              </button>
            </form>
          </div>
        </div>

        {/* 右：菜品列表 */}
        <div className="lg:w-[60%]">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-white font-semibold text-lg mb-1">📋 店内菜品</h2>
            <p className="text-gray-500 text-xs mb-5">共 {dishes.length} 道菜</p>

            {dishes.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-sm">暂无菜品，快去左侧上架吧！</div>
            ) : (
              <div className="space-y-3">
                {dishes.map(dish => {
                  const cat = categories.find(c => c.id === dish.dish_category_id)
                  return (
                    <div key={dish.id} className="bg-gray-800/50 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-white font-medium">{dish.name}</h3>
                            {cat && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">{cat.name}</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            {editingId === dish.id ? (
                              <div className="flex items-center gap-2">
                                <input type="number" step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                                  className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white" autoFocus
                                  onKeyDown={e => { if (e.key === 'Enter') handleEditPrice(dish.id); if (e.key === 'Escape') setEditingId(null) }} />
                                <button onClick={() => handleEditPrice(dish.id)} className="text-xs text-green-400 hover:text-green-300">保存</button>
                                <button onClick={() => { setEditingId(null); setEditPrice('') }} className="text-xs text-gray-500 hover:text-gray-400">取消</button>
                              </div>
                            ) : (
                              <span className="text-orange-400 font-semibold">¥{parseFloat(dish.price as unknown as string).toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          {editingId !== dish.id && (
                            <button onClick={() => { setEditingId(dish.id); setEditPrice(String(dish.price)) }}
                              className="px-3 py-1.5 text-xs bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors">
                              📝 修改价格
                            </button>
                          )}
                          <button onClick={() => handleDelete(dish.id, dish.name)}
                            className="px-3 py-1.5 text-xs bg-red-900/40 text-red-400 rounded-lg hover:bg-red-900/60 transition-colors">
                            🗑️ 下架
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
