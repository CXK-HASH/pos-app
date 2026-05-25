'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const DEFAULT_LOGOS = [
  { url: '', label: '无图片', color: 'border-gray-500' },
  { url: 'https://img.icons8.com/color/96/restaurant.png', label: '🍳 中餐', color: 'border-red-400' },
  { url: 'https://img.icons8.com/color/96/cafe.png', label: '☕ 咖啡', color: 'border-amber-400' },
  { url: 'https://img.icons8.com/color/96/ice-cream.png', label: '🍦 甜品', color: 'border-pink-400' },
  { url: 'https://img.icons8.com/color/96/french-fries.png', label: '🍟 快餐', color: 'border-yellow-400' },
  { url: 'https://img.icons8.com/color/96/noodles.png', label: '🍜 面食', color: 'border-orange-400' },
]

export default function AdminSetup() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [shopName, setShopName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        alert('登录已失效，请重新登录！')
        localStorage.clear()
        sessionStorage.clear()
        window.location.href = '/'
        return
      }

      const role = session.user.user_metadata?.role
      if (role !== 'merchant') {
        alert('权限不足，仅商家可访问此页面')
        localStorage.clear()
        sessionStorage.clear()
        window.location.href = '/'
        return
      }

      setUser({ id: session.user.id, email: session.user.email || '' })

      // 检查是否已有店铺 — 已有的话直接踢回 dashboard
      const hdrs = { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
      const res = await fetch('/api/admin/my-shop', { headers: hdrs })
      const data = await res.json()
      if (data.hasShop) {
        router.push('/admin/dashboard')
      }
    })()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shopName.trim()) return

    setSubmitting(true)
    setMessage(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const res = await fetch('/api/admin/my-shop', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shopName: shopName.trim(), logoUrl: logoUrl || null }),
      })

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || '创建失败')
      }

      setMessage({ type: 'info', text: '🎉 店铺创建成功，正在为您进入管理后台...' })
      setTimeout(() => {
        router.push('/admin/dashboard')
        router.refresh()
      }, 1500)
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '创建失败' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <p className="text-gray-400">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* 欢迎头 */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">欢迎入驻小龙虾外卖！</h1>
          <p className="text-sm text-gray-500">
            请先设置您的店铺信息，开启属于您的在线餐饮生意
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 space-y-6">
          {/* 店铺名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">🏪 店铺名称 *</label>
            <input
              value={shopName}
              onChange={e => setShopName(e.target.value)}
              placeholder="如：蜜雪冰城、正新鸡排"
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
            />
          </div>

          {/* Logo 选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">🖼️ 店铺 Logo</label>
            <p className="text-xs text-gray-400 mb-3">选择一个图标，或直接输入图片链接</p>

            <div className="flex flex-wrap gap-2 mb-3">
              {DEFAULT_LOGOS.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLogoUrl(opt.url)}
                  className={`px-3 py-1.5 text-xs rounded-xl border-2 transition-all ${
                    logoUrl === opt.url
                      ? `${opt.color} bg-orange-50 font-medium`
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <input
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
              placeholder="或粘贴图片链接 https://..."
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
            />
            {logoUrl && (
              <div className="mt-3 flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <img src={logoUrl} alt="" className="w-12 h-12 rounded-xl object-cover bg-gray-200" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                <span className="text-xs text-gray-400">预览</span>
              </div>
            )}
          </div>

          {message && (
            <p className={`text-sm ${message.type === 'error' ? 'text-red-500' : 'text-emerald-600 font-medium text-center'}`}>
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !shopName.trim()}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-40 transition-all active:scale-[0.98] text-base"
          >
            {submitting ? '创建中...' : '🚀 确认开店'}
          </button>

          <p className="text-center text-xs text-gray-400">
            {user.email} · <button type="button" onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="text-gray-500 hover:text-gray-700">换个账号</button>
          </p>
        </form>
      </div>
    </div>
  )
}
