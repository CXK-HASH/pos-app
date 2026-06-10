'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

/**
 * 全栈双核缝合组件
 * 
 * 在消费者角色下同时完成两件事：
 * 1. Dify 智能体注入（样式提权 + 配置绑定 + 脚本加载）
 * 2. 百度地图防抖限流全局守卫（覆盖 getLocationWithGuard 的 native 函数）
 */
export default function DifyChatbot() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      if (session.user.user_metadata?.role !== 'customer') return

      console.log('🤖 [DUAL_PATCH] 双核缝合启动')

      // ==========================================
      // 核心增量一：百度地图 10 分钟流量降载限流防线
      // ==========================================
      ;(window as any).getPreciseLocationWithGuard = function(point: any, callback: Function) {
        if (!point) return

        const cacheKey = `geo_cache_${point.lng.toFixed(4)}_${point.lat.toFixed(4)}`
        const cachedData = localStorage.getItem(cacheKey)
        const cacheTimestamp = localStorage.getItem(`${cacheKey}_time`)
        const now = Date.now()

        if (cachedData && cacheTimestamp && now - Number(cacheTimestamp) < 10 * 60 * 1000) {
          console.log("🛡️ [BAIDU_LIMIT_GUARD] 成功拦截高频出网，走本地空间地理缓存:", cachedData)
          callback(JSON.parse(cachedData))
          return
        }

        const geoc = new (window as any).BMap.Geocoder()
        geoc.getLocation(point, function(rs: any) {
          if (!rs) return
          const resultPayload = {
            addressComponents: rs.addressComponents,
            business: rs.business,
            surroundingPois: rs.surroundingPois || []
          }
          localStorage.setItem(cacheKey, JSON.stringify(resultPayload))
          localStorage.setItem(`${cacheKey}_time`, now.toString())
          callback(rs)
        }, { poiRadius: 150, numPois: 12 })
      }

      console.log('🛡️ [BAIDU_LIMIT_GUARD] 百度地图防抖拦截器已注册到 window.getPreciseLocationWithGuard')

      // ==========================================
      // 核心增量二：Dify 智能体动态脚本注入与手机端样式提权
      // ==========================================
      if ((window as any).difyChatbotConfig) {
        console.log('🤖 [DIFY_HOTFIX] Dify 已在 layout 全局加载，跳过重复注入')
        return
      }

      console.log("🤖 [DIFY_HOTFIX] 正在通过消费者入口强行注入 Dify 智能体网关...")

      // 1. 动态创建并注入最高权重的 CSS 样式
      // 先检查是否已有
      if (!document.getElementById('dify-dual-style')) {
        const styleTag = document.createElement('style')
        styleTag.id = 'dify-dual-style'
        styleTag.innerHTML = `
          #dify-chatbot-bubble-button {
            background-color: #1C64F2 !important;
            z-index: 999999 !important;
            bottom: 6rem !important;
            right: 1.5rem !important;
          }
          #dify-chatbot-bubble-window {
            z-index: 999999 !important;
          }
          @media (max-width: 768px) {
            #dify-chatbot-bubble-window {
              width: calc(100% - 2rem) !important;
              height: 70vh !important;
              bottom: 5.5rem !important;
              right: 1rem !important;
            }
          }
        `
        document.head.appendChild(styleTag)
      }

      // 2. 绑定 Dify 原生运行时基础上下文
      ;(window as any).difyChatbotConfig = {
        token: 'kXtniUYlZOuWJTKB',
        inputs: {},
        systemVariables: {},
        userVariables: {}
      }

      // 3. 动态异步挂载 Dify 核心引擎脚本（检查是否已有）
      if (!document.getElementById('kXtniUYlZOuWJTKB')) {
        const scriptTag = document.createElement('script')
        scriptTag.src = 'https://udify.app/embed.min.js'
        scriptTag.id = 'kXtniUYlZOuWJTKB'
        scriptTag.onload = () => {
          console.log("✅ [DIFY_REBOOT_SUCCESS] Dify 科技蓝 AI 气泡已满血复活！")
        }
        document.body.appendChild(scriptTag)
        console.log('✅ [DIFY_HOTFIX] Dify embed.min.js 已动态注入')
      }
    })
  }, [])

  return null
}
