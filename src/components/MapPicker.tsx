'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getLocationWithGuard } from '@/lib/baiduGuard'
import { convertToBd09 } from '@/lib/coordConvert'

declare global {
  interface Window {
    BMap: any
    BMapLib: any
  }
}

interface PoiItem {
  name: string
  address: string
  lat: number
  lng: number
}

interface MapPickerProps {
  open: boolean
  onClose: () => void
  onConfirm: (address: string, lat: number, lng: number) => void
  initialAddress?: string
  initialLat?: number
  initialLng?: number
}

export default function MapPicker({ open, onClose, onConfirm, initialAddress, initialLat, initialLng }: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(false)
  const [map, setMap] = useState<any>(null)
  const [marker, setMarker] = useState<any>(null)
  const [selectedAddress, setSelectedAddress] = useState(initialAddress || '')
  // 纯净化：不设固定回退坐标，由父组件传初始值；不传则等用户定位/搜索
  const [selectedLat, setSelectedLat] = useState(initialLat || 0)
  const [selectedLng, setSelectedLng] = useState(initialLng || 0)
  const [searchText, setSearchText] = useState(initialAddress || '')

  // POI 联想
  const [suggestions, setSuggestions] = useState<PoiItem[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [bmapReady, setBmapReady] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const panelRef = useRef<HTMLDivElement>(null)
  const checkTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // 跟踪组件挂载状态，防止 unmount 后 setState
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // 弹窗关闭时重置地图相关状态，保证下次打开全新初始化
  useEffect(() => {
    if (!open) {
      setMap(null)
      setMarker(null)
      setSuggestions([])
      setShowSuggestions(false)
      searchText !== (initialAddress || '') && setSearchText(initialAddress || '')
    } else {
      // 打开时清空 bmapReady，等待重新加载
      setBmapReady(false)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // 等 BMap 就绪
  useEffect(() => {
    if (!open) return
    const check = () => {
      if (!mountedRef.current) return
      if (typeof window !== 'undefined' && (window as any).BMap) {
        setBmapReady(true)
      } else {
        checkTimerRef.current = setTimeout(check, 200)
      }
    }
    check()
    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current)
    }
  }, [open])

  // ==================== 地图初始化 ====================
  useEffect(() => {
    if (!open || !bmapReady || !mapRef.current || map) return

    const initTimer = setTimeout(() => {
      if (!mountedRef.current) return

      // 未传坐标时兜底到郑州市中心
      const lng = selectedLng || 113.625
      const lat = selectedLat || 34.746
      const defaultPoint = new (window as any).BMap.Point(lng, lat)
      const bm = new (window as any).BMap.Map(mapRef.current)
      bm.centerAndZoom(defaultPoint, 15)
      bm.enableScrollWheelZoom(true)
      bm.addControl(new (window as any).BMap.NavigationControl())

      // 立即检测一次尺寸
      bm.checkResize()

      const mk = new (window as any).BMap.Marker(defaultPoint)
      mk.enableDragging()
      bm.addOverlay(mk)

      if (mountedRef.current) {
        setMarker(mk)
        setMap(bm)
        // 暴露给定位按钮使用
        ;(window as any).__bm__ = bm
      }

      // 动画完全结束后再次检查尺寸 + 重设中心（零值熔断：飞郑州）
      setTimeout(() => {
        if (!mountedRef.current || !bm) return
        bm.checkResize()
        // 二次熔断：防止 selectedLng/selectedLat 被异步改回 0
        const safeLng = selectedLng || 113.625
        const safeLat = selectedLat || 34.746
        if (safeLng === 113.625 && safeLat === 34.746) {
          console.log('⛑️ [MAP_SAFE_GUARD] 坐标保护触发，锚定郑州主城')
        }
        bm.setCenter(new (window as any).BMap.Point(safeLng, safeLat))
      }, 300)

      // 🚀 全图任意点选：Marker 跃迁 + POI 级地标反查 + 三位一体回填
      bm.addEventListener('click', (e: any) => {
        if (!mountedRef.current || !e.point) return

        const pt = e.point
        const clickedLng = pt.lng
        const clickedLat = pt.lat
        console.log('📍 [MAP_CLICK_DEBUG] 物理点击坐标:', clickedLng, clickedLat)

        // 1. 清除旧 Marker，新建 Marker 跃迁到点击处
        bm.clearOverlays()
        const newMk = new (window as any).BMap.Marker(pt)
        newMk.enableDragging()
        bm.addOverlay(newMk)
        setMarker(newMk)
        setSelectedLat(clickedLat)
        setSelectedLng(clickedLng)

        // 2. POI 级三位一体逆地理：省市区 + 路名 + 实体地标（带防抖拦截）
        getLocationWithGuard(
          clickedLng, clickedLat,
          (rs: any) => {
            if (!mountedRef.current) return
            const addComp = rs?.addressComponents
            if (!addComp) {
              setSelectedAddress(`${clickedLat.toFixed(4)},${clickedLng.toFixed(4)}`)
              return
            }

            const province = addComp.province || ''
            const city = addComp.city || ''
            const district = addComp.district || ''
            const street = addComp.street || ''
            const streetNum = addComp.streetNumber || ''

            // 提取最近 POI 地标（过滤纯路名）
            const pois = rs.surroundingPois || []
            const roadKeywords = ['路', '道', '街', '线', '桥', '高速']
            let matchedBuilding = ''
            for (const poi of pois) {
              const title = poi.title || ''
              const isPureRoad = roadKeywords.some(k => title.endsWith(k) || title.includes(k + '中'))
              if (!isPureRoad || title.includes('步行街') || title.includes('美食街')) {
                matchedBuilding = title
                break
              }
            }

            // 如果直接点中底图 POI 覆盖物（彩蛋）
            const directPoi = e.overlay?.title || ''
            const finalBuilding = directPoi || matchedBuilding || rs?.business || ''

            // 三位一体合成
            let finalAddr = `${province}${city}${district}${street}${streetNum}`
            if (finalBuilding && !finalBuilding.includes(street)) {
              finalAddr += finalBuilding
            } else if (finalBuilding) {
              finalAddr = `${province}${city}${district}${finalBuilding}`
            }
            finalAddr = finalAddr.replace(/undefined/gi, '').trim() || `${clickedLat.toFixed(4)},${clickedLng.toFixed(4)}`

            console.log('🚀 [CLICK_ADDRESS_SYNC] 点击选点地址合成完毕:', finalAddr)
            setSelectedAddress(finalAddr)
            setSearchText(finalAddr)
          },
        )
        function noop() {}
      })

      // 拖拽结束（带防抖）
      let dragTimer: ReturnType<typeof setTimeout>
      mk.addEventListener('dragend', (e: any) => {
        if (!mountedRef.current) return
        const pt = e.point
        setSelectedLat(pt.lat)
        setSelectedLng(pt.lng)
        if (dragTimer) clearTimeout(dragTimer)
        dragTimer = setTimeout(() => {
          if (!mountedRef.current) return
          getLocationWithGuard(
            pt.lng, pt.lat,
            (rs: any) => {
              if (!mountedRef.current) return
              const addr = rs?.address || `${pt.lat.toFixed(4)},${pt.lng.toFixed(4)}`
              setSelectedAddress(addr)
            }
          )
        }, 500)
      })
    }, 150)

    return () => {
      clearTimeout(initTimer)
      if (map) {
        try { ;(map as any).destroy() } catch { /* ignore */ }
      }
    }
  }, [open, bmapReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // 防抖 POI 检索
  const searchPoi = useCallback((keyword: string) => {
    if (!keyword.trim() || keyword.trim().length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    try {
      const local = new (window as any).BMap.LocalSearch('', {
        pageCapacity: 6,
        onSearchComplete: () => {
          if (!mountedRef.current) return
          const status = local.getStatus()
          console.log('📡 [MAP_POI_DEBUG] 百度地图检索状态码:', status, '关键词:', keyword)

          if (status === 0) {
            const results = local.getResults()
            if (!results) {
              setSuggestions([])
              setShowSuggestions(false)
              return
            }
            const poiList: PoiItem[] = []
            for (let i = 0; i < results.getCurrentNumPois(); i++) {
              const poi = results.getPoi(i)
              poiList.push({
                name: poi.title,
                address: poi.address,
                lat: poi.point.lat,
                lng: poi.point.lng,
              })
            }
            console.log('📥 [MAP_POI_DEBUG] 成功抓取 POI 候选集:', poiList)
            if (poiList.length > 0) {
              setSuggestions(poiList)
              setShowSuggestions(true)
            } else {
              setSuggestions([])
              setShowSuggestions(false)
            }
          } else {
            console.error('❌ [MAP_POI_DEBUG] 百度检索失败，状态码:', status, '关键词:', keyword)
            setSuggestions([])
            setShowSuggestions(false)
          }
        },
      })
      local.search(keyword.trim())
    } catch (err) {
      console.error('❌ [MAP_POI_DEBUG] searchPoi 异常:', err)
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [])

  // 输入变化：防抖触发检索
  const handleInputChange = (value: string) => {
    setSearchText(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    debounceRef.current = setTimeout(() => {
      if (mountedRef.current) searchPoi(value.trim())
    }, 300)
  }

  // 选中 POI
  const handleSelectPoi = (poi: PoiItem) => {
    if (!mountedRef.current) return
    setSearchText(poi.name)
    setSelectedAddress(poi.address || poi.name)
    setSelectedLat(poi.lat)
    setSelectedLng(poi.lng)
    setSuggestions([])
    setShowSuggestions(false)

    if (map) {
      map.clearOverlays()
      const pt = new (window as any).BMap.Point(poi.lng, poi.lat)
      map.centerAndZoom(pt, 16)
      const newMk = new (window as any).BMap.Marker(pt)
      newMk.enableDragging()
      map.addOverlay(newMk)
      setMarker(newMk)
    }
  }

  // 点击外部关闭联想面板
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 打开时聚焦
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [open])

  // ==================== 搜索 ====================
  const handleSearch = () => {
    if (!map || !searchText.trim() || !mountedRef.current) return
    const local = new (window as any).BMap.LocalSearch(map, {
      renderOptions: { map, autoViewport: true },
      onSearchComplete: (results: any) => {
        if (!mountedRef.current) return
        if (results?.getNumPois() > 0) {
          const poi = results.getPoi(0)
          const pt = poi.point
          map.clearOverlays()
          const newMk = new (window as any).BMap.Marker(pt)
          newMk.enableDragging()
          map.addOverlay(newMk)
          setMarker(newMk)
          setSelectedLat(pt.lat)
          setSelectedLng(pt.lng)
          setSelectedAddress(poi.address || poi.title)
        }
      },
    })
    local.search(searchText.trim())
    setShowSuggestions(false)
  }

  // ==================== 当前定位（纯 HTML5 GPS，无需降级）====================
  const handleLocate = () => {
    if (!map || !(window as any).BMap || !mountedRef.current) return

    if (!navigator.geolocation) {
      alert('您的浏览器不支持 GPS 定位，请搜索地址或在地图上点击选择')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!mountedRef.current) return
        const wgsLat = pos.coords.latitude
        const wgsLng = pos.coords.longitude
        console.log('🎯 [GPS] HTML5 GPS 获取到精确坐标（WGS-84）:', wgsLat, wgsLng)

        // 转 BD-09
        convertToBd09(wgsLat, wgsLng).then((bdCoord: { lat: number; lng: number }) => {
          if (!mountedRef.current) return
          const { lat, lng } = bdCoord
          console.log('🎯 [GPS] BD-09 坐标:', lat, lng)

          map.clearOverlays()
          map.centerAndZoom(new (window as any).BMap.Point(lng, lat), 17)
          const newMk = new (window as any).BMap.Marker(new (window as any).BMap.Point(lng, lat))
          newMk.enableDragging()
          map.addOverlay(newMk)
          setMarker(newMk)
          setSelectedLat(lat)
          setSelectedLng(lng)

          // 逆地理编码取精确地址
          getLocationWithGuard(
            lng, lat,
            (rs: any) => {
              if (!mountedRef.current) return
              const addComp = rs?.addressComponents
              if (!addComp) {
                setSelectedAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)
                return
              }
              const baseArea = `${addComp.province || ''}${addComp.city || ''}${addComp.district || ''}`.replace(/undefined/gi, '')
              const primaryPoi = rs?.surroundingPois?.[0]
              const poiTitle = primaryPoi?.title || ''
              let finalAddr: string
              if (poiTitle) {
                finalAddr = `${baseArea}${poiTitle}`
                console.log('🏢 [POI_PRECISE_DEBUG] 精准地标捕获:', finalAddr, '| POI:', primaryPoi)
              } else {
                const streetInfo = `${addComp.street || ''}${addComp.streetNumber || ''}`.replace(/undefined/gi, '')
                finalAddr = `${baseArea}${streetInfo}` || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
              }
              finalAddr = finalAddr.replace(/undefined/gi, '').trim()
              setSelectedAddress(finalAddr)
              setSearchText(finalAddr)
            },
          )
        })
      },
      (err) => {
        console.warn('⚠️ [GPS] 定位失败:', err.code, err.message)
        // GPS 失败不降级到 IP 定位（IP 定位不准），提示用户手动选择
        alert('GPS 定位失败，请在搜索框中输入地址或在地图上点击选择')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  // ==================== 关闭（仅清空临时状态 = 解耦零副作用）====================
  const handleClose = () => {
    setSuggestions([])
    setShowSuggestions(false)
    // 不修改任何选中地址/坐标状态，不触发父组件回传
    onClose()
  }

  // ==================== 确认（含空值/脏数据防御）====================
  const handleConfirm = () => {
    if (!mountedRef.current) return
    const raw = selectedAddress || searchText || `${selectedLat.toFixed(4)},${selectedLng.toFixed(4)}`
    const addr = String(raw).replace(/undefined|null/gi, '').trim()

    if (!selectedLng || !selectedLat || !addr || addr === '') {
      console.error('❌ [ROUTE_GUARD] 不合规的空间参数，拒绝提交流水线！', { address: addr, lng: selectedLng, lat: selectedLat })
      alert('请先选择一个有效的位置')
      return
    }

    // 确认成功才关闭
    onConfirm(addr, selectedLat, selectedLng)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">📍 选择位置</h3>
          <button onClick={handleClose} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200">✕</button>
        </div>

        {/* 搜索栏 + 联想面板 */}
        <div className="p-4 pb-0 relative">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                value={searchText}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); handleSearch() }
                }}
                placeholder="搜索地址，如郑州东站..."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-orange-500"
              />

              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={panelRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-[9999] max-h-[240px] overflow-y-auto"
                  style={{ position: 'absolute', zIndex: 9999 }}
                >
                  {suggestions.map((poi, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectPoi(poi)}
                      className="px-4 py-3 hover:bg-orange-50 cursor-pointer border-b border-slate-50 last:border-b-0 transition-colors"
                    >
                      <div className="text-sm font-medium text-slate-800">{poi.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">{poi.address}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleSearch} className="px-4 py-2 bg-orange-500 text-white text-sm rounded-xl hover:bg-orange-600 transition-all whitespace-nowrap">
              搜索
            </button>
            <button onClick={handleLocate} className="px-4 py-2 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 transition-all whitespace-nowrap" title="定位当前位置">
              📍
            </button>
          </div>
        </div>

        {/* 地图区域 */}
        <div className="p-4 flex-1 min-h-0">
          <div ref={mapRef} className="w-full h-[300px] rounded-xl" />
        </div>

        {/* 选中地址信息（零值保护） */}
        <div className="px-4 pb-2">
          <p className="text-sm text-slate-500">
            <span className="text-orange-500">📍</span> 当前选中：
            <span className="text-slate-800 font-medium ml-1">{selectedAddress || searchText || '等待获取或检索位置'}</span>
          </p>
          {selectedLng !== 0 && selectedLat !== 0 && (
            <p className="text-xs text-slate-400 mt-0.5 ml-5">{selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}</p>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="p-4 pt-2 flex gap-3 border-t border-slate-100">
          <button onClick={handleClose} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200">
            取消
          </button>
          <button onClick={handleConfirm} className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm font-bold hover:shadow-md transition-all">
            确认地址
          </button>
        </div>
      </div>
    </div>
  )
}
