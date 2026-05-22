'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      let result
      if (isSignUp) {
        result = await supabase.auth.signUp({ email, password })
        if (result.error) throw result.error
        setMessage({ type: 'success', text: '注册成功！请查看邮箱确认链接，或直接尝试登录。' })
      } else {
        result = await supabase.auth.signInWithPassword({ email, password })
        if (result.error) throw result.error
        router.push('/')
        router.refresh()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败'
      setMessage({ type: 'error', text: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🍽️</div>
          <h1 className="text-2xl font-bold text-gray-900">小龙虾外卖</h1>
          <p className="text-sm text-gray-400 mt-1">{isSignUp ? '创建新账号' : '登录您的账号'}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
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
              💡 若注册提示邮件超限，请直接使用测试账号登录：<br />
              账号 <span className="text-gray-500">test1234@qq.com</span> 密码 <span className="text-gray-500">123456</span>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
