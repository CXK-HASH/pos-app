'use client'

import { useEffect, useState, useCallback } from 'react'

interface WeatherData {
  text: string
  temp: string
  wind: string
}

// 天气图标映射
const WEATHER_ICONS: Record<string, string> = {
  '晴': '☀️',
  '多云': '⛅',
  '阴': '☁️',
  '小雨': '🌦️',
  '中雨': '🌧️',
  '大雨': '🌧️',
  '暴雨': '🌊',
  '雷阵雨': '⛈️',
  '雪': '❄️',
  '雾': '🌫️',
  '霾': '😶‍🌫️',
}

function getWeatherIcon(text: string): string {
  for (const [key, emoji] of Object.entries(WEATHER_ICONS)) {
    if (text.includes(key)) return emoji
  }
  if (text.includes('雨')) return '🌧️'
  if (text.includes('云')) return '⛅'
  if (text.includes('晴')) return '☀️'
  return '🌤️'
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchWeather = useCallback(async () => {
    setLoading(true)

    // 从 localStorage 读取 adcode（全角色联动：customer_ / driver_ / merchant_）
    const adcode = typeof window !== 'undefined'
      ? (localStorage.getItem('customer_adcode') ||
         localStorage.getItem('driver_adcode') ||
         null)
      : null
    const districtId = adcode || '410100' // 兜底郑州

    try {
      const url = `/api/weather?district_id=${districtId}`
      console.log('🌤️ [WEATHER_LINKAGE] 请求天气 adcode:', districtId)
      const res = await fetch(url)
      const json = await res.json()

      console.log('🌤️ [WEATHER_LINKAGE] 响应:', json)

      if (json.status === 0 && json.result?.now) {
        const now = json.result.now
        setWeather({
          text: now.text || '未知',
          temp: now.temp + '°C',
          wind: now.wind_dir || '',
        })
      } else {
        console.warn('❄️ [WEATHER_LINKAGE] API 返回异常:', json)
      }
    } catch (err) {
      console.error('❌ [WEATHER_LINKAGE] 网络请求异常:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // 初始加载 + 监听 localStorage 变化（选址弹窗确认后手动触发的 storage 事件）
    const timer = setTimeout(fetchWeather, 600)

    const handleStorage = () => fetchWeather()
    window.addEventListener('storage', handleStorage)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('storage', handleStorage)
    }
  }, [fetchWeather])

  // 加载中骨架
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-4 h-4 rounded-full bg-slate-200 animate-pulse" />
        <span className="w-10 h-3 bg-slate-200 rounded animate-pulse" />
      </div>
    )
  }

  // 空数据熔断
  if (!weather) return null

  const icon = getWeatherIcon(weather.text)

  return (
    <div
      className="flex items-center gap-1.5 shrink-0 text-xs whitespace-nowrap bg-slate-100/80 px-2.5 py-1 rounded-full font-semibold"
      title={`${weather.text} | ${weather.wind}`}
    >
      <span className="text-sm">{icon}</span>
      <span className="text-slate-800 font-bold">{weather.temp}</span>
      <span className="text-slate-400 hidden sm:inline">{weather.text}</span>
    </div>
  )
}
