'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type VideoItem = {
  id: number
  url: string
  width: number
  height: number
  duration: number
  cover: string
  author: string
  authorUrl: string
}

export default function VideoFeed() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])

  // 路由守卫
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        window.location.href = '/'
        return
      }
      const role = session.user.user_metadata?.role
      if (role !== 'customer') {
        window.location.href = '/'
        return
      }
    })
  }, [])

  // 加载视频
  const fetchVideos = useCallback(async (p: number) => {
    try {
      const res = await fetch(`/api/videos/feed?page=${p}&per_page=10`)
      const data = await res.json()
      if (data.videos && data.videos.length > 0) {
        setVideos(prev => p === 1 ? data.videos : [...prev, ...data.videos])
      } else {
        setHasMore(false)
      }
    } catch (e) {
      console.error('视频加载失败', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVideos(page)
  }, [page, fetchVideos])

  // 视频播放控制
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return
      if (i === currentIndex) {
        video.currentTime = 0
        video.play().catch(() => {})
      } else {
        video.pause()
        video.currentTime = 0
      }
    })
  }, [currentIndex])

  // 预加载
  useEffect(() => {
    if (currentIndex >= videos.length - 3 && hasMore) {
      setPage(p => p + 1)
    }
  }, [currentIndex, videos.length, hasMore])

  // 触摸滑动处理
  const touchStart = useRef(0)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientY
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStart.current - e.changedTouches[0].clientY
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < videos.length - 1) {
        setCurrentIndex(i => i + 1)
      } else if (diff < 0 && currentIndex > 0) {
        setCurrentIndex(i => i - 1)
      }
    }
  }

  // 滚轮滑动
  let wheelTimeout: ReturnType<typeof setTimeout> | null = null
  const handleWheel = (e: React.WheelEvent) => {
    if (wheelTimeout) return
    wheelTimeout = setTimeout(() => {
      wheelTimeout = null
    }, 800)
    if (e.deltaY > 0 && currentIndex < videos.length - 1) {
      setCurrentIndex(i => i + 1)
    } else if (e.deltaY < 0 && currentIndex > 0) {
      setCurrentIndex(i => i - 1)
    }
  }

  const setVideoRef = (el: HTMLVideoElement | null, idx: number) => {
    videoRefs.current[idx] = el
  }

  return (
    <div className="fixed inset-0 bg-black z-50"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* 顶部 */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
        <button
          onClick={() => router.push('/customer/home')}
          className="text-white text-2xl cursor-pointer"
        >
          ←
        </button>
        <span className="text-white font-bold text-sm">🎬 刷视频</span>
        <div className="w-8"></div>
      </div>

      {/* 视频滑动容器 */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden relative"
        style={{ transform: `translateY(-${currentIndex * 100}%)`, transition: 'transform 0.4s ease-out' }}
      >
        {loading && videos.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-white border-t-transparent"></div>
            <span className="ml-3 text-sm">加载中...</span>
          </div>
        ) : videos.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">
            暂无视频
          </div>
        ) : (
          videos.map((video, idx) => (
            <div key={video.id} className="h-full w-full flex items-center justify-center relative">
              <video
                ref={el => setVideoRef(el, idx)}
                src={video.url}
                poster={video.cover}
                muted
                loop
                playsInline
                preload={idx === currentIndex ? 'auto' : 'none'}
                className="w-full h-full object-cover"
              />
              {/* 底部信息 */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                <p className="text-white font-medium text-sm">@{video.author}</p>
              </div>
              {/* 进度指示 */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1">
                {videos.slice(0, 10).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all duration-300 ${
                      i === currentIndex
                        ? 'h-5 bg-white'
                        : Math.abs(i - currentIndex) <= 1
                        ? 'h-2 bg-white/50'
                        : 'h-1 bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
