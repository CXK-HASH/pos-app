'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

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
  const [selectedLat, setSelectedLat] = useState(initialLat || 23.128)
  const [selectedLng, setSelectedLng] = useState(initialLng || 113.262)
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

  // 等 BMap 就绪（含清理保护）
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

  // ==================== 地图初始化（200ms 延迟等待弹窗动画 + 容器尺寸检测）====================
  useEffect(() => {
    if (!open || !bmapReady || !mapRef.current) return

    // 延迟实例化，确保弹窗动画和容器渲染完毕
    const initTimer = setTimeout(() => {
      if (!mountedRef.current || map) return

      const defaultPoint = new (window as any).BMap.Point(selectedLng, selectedLat)
      const bm = new (window as any).BMap.Map(mapRef.current)
      bm.centerAndZoom(defaultPoint, 15)
      bm.enableScrollWheelZoom(true)
      bm.addControl(new (window as any).BMap.NavigationControl())

      const mk = new (window as any).BMap.Marker(defaultPoint)
      mk.enableDragging()
      bm.addOverlay(mk)

      if (mountedRef.current) {
        setMarker(mk)
        setMap(bm)
      }

      // 鼠标点击重新标点
      let clickTimer: ReturnType<typeof setTimeout>
      bm.addEventListener('click', (e: any) => {
        if (!mountedRef.current) return
        const pt = e.latlng
        bm.clearOverlays()
        const newMk = new (window as any).BMap.Marker(pt)
        newMk.enableDragging()
        bm.addOverlay(newMk)
        if (!mountedRef.current) return
        setMarker(newMk)
        setSelectedLat(pt.lat)
        setSelectedLng(pt.lng)
        if (clickTimer) clearTimeout(clickTimer)
        clickTimer = setTimeout(() => {
          if (!mountedRef.current) return
          const gc = new (window as any).BMap.Geocoder()
          gc.getLocation(pt, (rs: any) => {
            if (!mountedRef.current) return
            const addr = rs?.address || `${pt.lat.toFixed(4)},${pt.lng.toFixed(4)}`
            setSelectedAddress(addr)
          })
        }, 500)
      })

      // 拖拽结束
      let dragTimer: ReturnType<typeof setTimeout>
      mk.addEventListener('dragend', (e: any) => {
        if (!mountedRef.current) return
        const pt = e.point
        setSelectedLat(pt.lat)
        setSelectedLng(pt.lng)
        if (dragTimer) clearTimeout(dragTimer)
        dragTimer = setTimeout(() => {
          if (!mountedRef.current) return
          const gc = new (window as any).BMap.Geocoder()
          gc.getLocation(pt, (rs: any) => {
            if (!mountedRef.current) return
            const addr = rs?.address || `${pt.lat.toFixed(4)},${pt.lng.toFixed(4)}`
            setSelectedAddress(addr)
          })
        }, 500)
      })
    }, 200)

    return () => {
      clearTimeout(initTimer)
      if (map) {
        try { ;(map as any).destroy() } catch { /* ignore */ }
        setMap(null)
      }
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ==================== 当前定位 ====================
  const handleLocate = () => {
    if (!map || !(window as any).BMap || !mountedRef.current) return
    try {
      const geolocation = new (window as any).BMap.Geolocation()
      geolocation.enableSDKLocation()
      geolocation.getCurrentPosition(
        function (this: any, r: any) {
          if (!mountedRef.current) return
          if (this.getStatus() === (window as any).BMAP_STATUS_SUCCESS) {
            const pt = r.point
            console.log('🎯 [MAP_LOCATION_DEBUG] 高精度定位坐标:', pt.lat, pt.lng)
            map.clearOverlays()
            map.centerAndZoom(pt, 16)
            const newMk = new (window as any).BMap.Marker(pt)
            newMk.enableDragging()
            map.addOverlay(newMk)
            setMarker(newMk)
            setSelectedLat(pt.lat)
            setSelectedLng(pt.lng)
            const addr = r.address
            if (addr) {
              const safeNum = addr.streetNumber || ''
              const addrStr = `${addr.city || ''}${addr.district || ''}${addr.street || ''}${safeNum}`.replace(/undefined/gi, '').trim()
              setSelectedAddress(addrStr)
              setSearchText(addrStr)
            } else {
              setSelectedAddress(`${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}`)
            }
          } else {
            console.warn('⚠️ [MAP_LOCATION_DEBUG] 高精度定位失败，状态码:', this.getStatus(), '— IP 定位降级')
            if (r && r.point && mountedRef.current) {
              const pt = r.point
              map.clearOverlays()
              map.centerAndZoom(pt, 14)
              const newMk = new (window as any).BMap.Marker(pt)
              map.addOverlay(newMk)
              setMarker(newMk)
              setSelectedLat(pt.lat)
              setSelectedLng(pt.lng)
              const addr = r.address
              if (addr) {
                const safeNum = addr.streetNumber || ''
                const addrStr = `${addr.city || ''}${addr.district || ''}${addr.street || ''}${safeNum}`.replace(/undefined/gi, '').trim()
                setSelectedAddress(addrStr)
                setSearchText(addrStr)
              }
            }
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      )
    } catch (err) {
      console.error('❌ [MAP_LOCATION_DEBUG] 定位异常:', err)
      alert('定位异常，请刷新后重试')
    }
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

        {/* 选中地址信息 */}
        <div className="px-4 pb-2">
          <p className="text-sm text-slate-500">
            <span className="text-orange-500">📍</span> 当前选中：
            <span className="text-slate-800 font-medium ml-1">{selectedAddress || searchText || '未选择'}</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5 ml-5">{selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}</p>
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
