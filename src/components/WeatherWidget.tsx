'use client'

import { useEffect, useState, useCallback } from 'react'

interface WeatherData {
  text: string   // 天气情况：晴、多云、阴、雨等
  temp: string   // 温度，如 "28℃"
  wind: string   // 风向风力，如 "南风3-4级"
}

interface WeatherWidgetProps {
  city?: string // 可选，不传则使用 localStorage 推断
}

// 天气图标映射
const weatherIconMap: Record<string, string> = {
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
  // 模糊匹配
  for (const [key, emoji] of Object.entries(weatherIconMap)) {
    if (text.includes(key)) return emoji
  }
  if (text.includes('雨')) return '🌧️'
  if (text.includes('云')) return '⛅'
  if (text.includes('晴')) return '☀️'
  return '🌤️' // 默认
}

export default function WeatherWidget({ city: propCity }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const fetchWeather = useCallback(async (cityName: string) => {
    if (!window.BMap || !cityName) return
    setLoading(true)
    setError(false)

    try {
      const Weather = (window as any).BMap.Weather
      if (!Weather) {
        // 百度 3.0 可能不包含 Weather 类，换个方案
        console.warn('❄️ [WEATHER_DEBUG] BMap.Weather 不可用，跳过')
        setError(true)
        setLoading(false)
        return
      }
      const weatherInstance = new Weather()
      weatherInstance.getWeatherByDistrictName(cityName, (results: any) => {
        if (results?.currentWeather) {
          const data = results.currentWeather
          console.log('🌤️ [WEATHER_DEBUG] 实时天气:', cityName, data)
          setWeather({
            text: data.text || '未知',
            temp: data.date || '--',
            wind: data.wind || '',
          })
        } else {
          console.warn('❄️ [WEATHER_DEBUG] 天气结果为空:', cityName, results)
          setError(true)
        }
        setLoading(false)
      })
    } catch (err) {
      console.error('❌ [WEATHER_DEBUG] 天气请求异常:', err)
      setError(true)
      setLoading(false)
    }
  }, [])

  // 读取城市名（优先 prop > localStorage > 默认郑州）
  useEffect(() => {
    const city = propCity || (typeof window !== 'undefined' && localStorage.getItem('customer_city')) || '郑州市'
    // 等 BMap 就绪
    const checkBMap = () => {
      if (typeof window !== 'undefined' && (window as any).BMap) {
        fetchWeather(city)
      } else {
        setTimeout(checkBMap, 300)
      }
    }
    // 延迟执行，确保 SDK 加载
    setTimeout(checkBMap, 500)
  }, [propCity, fetchWeather])

  // 加载中骨架
  if (loading) {
    return (
      <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
        <span className="w-4 h-4 bg-slate-200 rounded-full animate-pulse" />
        <span className="w-8 h-3 bg-slate-200 rounded animate-pulse" />
      </div>
    )
  }

  // 失败/空数据 — 静默不渲染
  if (error || !weather) {
    return null
  }

  const icon = getWeatherIcon(weather.text)

  return (
    <div className="flex items-center gap-1.5 shrink-0 text-xs whitespace-nowrap" title={`${weather.text} | ${weather.wind}`}>
      <span className="text-sm">{icon}</span>
      <span className="font-bold text-slate-800">{weather.temp}</span>
      <span className="text-slate-400 hidden sm:inline">{weather.text}</span>
    </div>
  )
}
