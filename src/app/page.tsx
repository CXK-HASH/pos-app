'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function HomeLoginPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'customer' | 'merchant' | 'driver'>('customer')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  /** 登录成功后，通过 gatekeeper 统一分流 */
  const redirectAfterLogin = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }

    const res = await fetch('/api/auth/gatekeeper', {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
    const data = await res.json()
    router.push(data.redirectTo || '/')
    router.refresh()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      if (isSignUp) {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, role }),
        })
        const data = await res.json()

        if (!data.success) {
          throw new Error(data.error || '注册失败')
        }

        const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password })
        if (loginErr) throw loginErr

        setMessage({ type: 'success', text: '🎉 账号注册并自动激活成功！' })
        setTimeout(() => redirectAfterLogin(), 1000)
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password })
        if (result.error) throw result.error
        await redirectAfterLogin()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败'
      setMessage({ type: 'error', text: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍽️</div>
          <h1 className="text-2xl font-bold text-gray-900">小龙虾外卖</h1>
          <p className="text-sm text-gray-400 mt-1">
            {isSignUp ? '注册账号开启美食之旅' : '登录进入您的专属空间'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="至少 6 位"
              required
              minLength={6}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
            />
          </div>

          {isSignUp && (
            <div className="mb-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">选择您的身份</label>
              <div className="grid grid-cols-3 gap-2">
                <label className={`flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all text-sm ${
                  role === 'customer'
                    ? 'border-orange-500 bg-orange-50 text-orange-600 font-bold'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}>
                  <input type="radio" name="role" value="customer" checked={role === 'customer'} onChange={() => setRole('customer')} className="sr-only" />
                  <span>🛒 消费者</span>
                </label>
                <label className={`flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all text-sm ${
                  role === 'merchant'
                    ? 'border-orange-500 bg-orange-50 text-orange-600 font-bold'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}>
                  <input type="radio" name="role" value="merchant" checked={role === 'merchant'} onChange={() => setRole('merchant')} className="sr-only" />
                  <span>🏪 商家</span>
                </label>
                <label className={`flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all text-sm ${
                  role === 'driver'
                    ? 'border-orange-500 bg-orange-50 text-orange-600 font-bold'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}>
                  <input type="radio" name="role" value="driver" checked={role === 'driver'} onChange={() => setRole('driver')} className="sr-only" />
                  <span>🚴 骑手</span>
                </label>
              </div>
            </div>
          )}

          {message && (
            <p className={`text-xs ${message.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {loading ? '处理中...' : isSignUp ? '注册' : '登录'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setMessage(null) }}
              className="text-sm text-orange-600 hover:text-orange-700"
            >
              {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
            </button>
          </div>

          <div className="pt-2 border-t border-gray-50 mt-2">
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              💡 测试账号：<br />
              消费者 <span className="text-gray-500">test1234@qq.com</span> / <span className="text-gray-500">123456</span>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
