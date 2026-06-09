'use client'

import { useEffect, useState, useCallback } from 'react'

interface WeatherData {
  text: string
  temp: string
  wind: string
}

interface WeatherWidgetProps {
  city?: string
}

// ——— 城市 → 行政编码映射（主战场郑州及周围） ———
const CITY_CODE_MAP: Record<string, string> = {
  '郑州市': '410100',
  '郑州': '410100',
  '洛阳': '410300',
  '开封': '410200',
  '新乡': '410700',
  '许昌': '411000',
  '北京': '110000',
  '上海': '310000',
  '广州': '440100',
  '深圳': '440300',
}

// 默认郑州行政编码
const DEFAULT_CITY_CODE = '410100'

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

export default function WeatherWidget({ city: propCity }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchWeather = useCallback(async () => {
    setLoading(true)

    // 确定城市编码
    const cityName = (propCity || (typeof window !== 'undefined' && localStorage.getItem('customer_city')) || '郑州市').replace(/市$/, '')
    const districtId = CITY_CODE_MAP[cityName] || CITY_CODE_MAP[`${cityName}市`] || DEFAULT_CITY_CODE

    try {
      const url = `/api/weather?district_id=${districtId}`
      console.log('🌤️ [WEATHER_DEBUG] 请求代理:', url)
      const res = await fetch(url)
      const json = await res.json()

      console.log('🌤️ [WEATHER_DEBUG] 响应:', json)

      if (json.status === 0 && json.result?.now) {
        const now = json.result.now
        setWeather({
          text: now.text || '未知',
          temp: now.temp + '°C',
          wind: now.wind_dir || '',
        })
      } else {
        console.warn('❄️ [WEATHER_DEBUG] API 返回异常:', json)
      }
    } catch (err) {
      console.error('❌ [WEATHER_DEBUG] 网络请求异常:', err)
    } finally {
      setLoading(false)
    }
  }, [propCity])

  useEffect(() => {
    // 等页面加载稳定后再请求
    const timer = setTimeout(fetchWeather, 800)
    return () => clearTimeout(timer)
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

  // 空数据熔断 — 静默不渲染
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
