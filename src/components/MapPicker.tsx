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
  const [map, setMap] = useState<any>(null)
  const [marker, setMarker] = useState<any>(null)
  const [selectedAddress, setSelectedAddress] = useState(initialAddress || '')
  const [selectedLat, setSelectedLat] = useState(initialLat || 23.128)
  const [selectedLng, setSelectedLng] = useState(initialLng || 113.262)
  const [searchText, setSearchText] = useState(initialAddress || '')

  // POI 联想
  const [suggestions, setSuggestions] = useState<PoiItem[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const panelRef = useRef<HTMLDivElement>(null)
  const autoCompleteRef = useRef<any>(null)

  // ==================== 地图初始化 ====================
  useEffect(() => {
    if (!open || !window.BMap || !mapRef.current) return

    // 清理旧实例
    if (map) return // 已初始化

    const defaultPoint = new window.BMap.Point(selectedLng, selectedLat)
    const bm = new window.BMap.Map(mapRef.current)
    bm.centerAndZoom(defaultPoint, 15)
    bm.enableScrollWheelZoom(true)
    bm.addControl(new window.BMap.NavigationControl())

    const mk = new window.BMap.Marker(defaultPoint)
    mk.enableDragging()
    bm.addOverlay(mk)
    setMarker(mk)

    // 鼠标点击重新标点
    bm.addEventListener('click', (e: any) => {
      const pt = e.latlng
      bm.clearOverlays()
      const newMk = new window.BMap.Marker(pt)
      newMk.enableDragging()
      bm.addOverlay(newMk)
      setMarker(newMk)
      setSelectedLat(pt.lat)
      setSelectedLng(pt.lng)
      const gc = new window.BMap.Geocoder()
      gc.getLocation(pt, (rs: any) => {
        const addr = rs?.address || `${pt.lat.toFixed(4)},${pt.lng.toFixed(4)}`
        setSelectedAddress(addr)
      })
    })

    // 拖拽结束
    mk.addEventListener('dragend', (e: any) => {
      const pt = e.point
      setSelectedLat(pt.lat)
      setSelectedLng(pt.lng)
      const gc = new window.BMap.Geocoder()
      gc.getLocation(pt, (rs: any) => {
        const addr = rs?.address || `${pt.lat.toFixed(4)},${pt.lng.toFixed(4)}`
        setSelectedAddress(addr)
      })
    })

    setMap(bm)

    return () => {
      bm.destroy()
      setMap(null)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== 百度地图 Autocomplete 离线联想 ====================
  const initAutocomplete = useCallback(() => {
    if (autoCompleteRef.current || !inputRef.current || !window.BMap) return

    try {
      // 方案 B：手动 LocalSearch 防抖联想（更可控）
      // Ac 已绑定到 inputRef，但 BMap.Autocomplete 需要 DOM id
      // 使用方案 B 更灵活
    } catch { /* ignore */ }
  }, [])

  // 防抖 POI 检索
  const searchPoi = useCallback((keyword: string) => {
    if (!keyword.trim() || keyword.trim().length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    // 用 BMap.LocalSearch 检索，传空字符串表示全国范围
    // 注意：不能传 '中国'，百度 API 需要城市名或空字符串
    try {
      const local = new window.BMap.LocalSearch('', {
        pageCapacity: 6,
        onSearchComplete: () => {
          const status = local.getStatus()
          console.log('📡 [MAP_POI_DEBUG] 百度地图检索状态码 (Status):', status, '关键词:', keyword)

          // BMAP_STATUS_SUCCESS = 0
          if (status === 0) {
            const results = local.getResults()
            if (!results) {
              console.warn('📡 [MAP_POI_DEBUG] results 为空')
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
            console.error('❌ [MAP_POI_DEBUG] 百度检索失败，请自查 AK 类型或网络！错误状态码:', status, '关键词:', keyword)
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
    debounceRef.current = setTimeout(() => searchPoi(value.trim()), 300)
  }

  // 选中 POI
  const handleSelectPoi = (poi: PoiItem) => {
    setSearchText(poi.name)
    setSelectedAddress(poi.address || poi.name)
    setSelectedLat(poi.lat)
    setSelectedLng(poi.lng)
    setSuggestions([])
    setShowSuggestions(false)

    // 同步移动地图标记
    if (map) {
      map.clearOverlays()
      const pt = new window.BMap.Point(poi.lng, poi.lat)
      map.centerAndZoom(pt, 16)
      const newMk = new window.BMap.Marker(pt)
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

  // 打开时重新聚焦
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [open])

  // ==================== 搜索（地图跳转） ====================
  const handleSearch = () => {
    if (!map || !searchText.trim()) return
    const local = new window.BMap.LocalSearch(map, {
      renderOptions: { map, autoViewport: true },
      onSearchComplete: (results: any) => {
        if (results?.getNumPois() > 0) {
          const poi = results.getPoi(0)
          const pt = poi.point
          map.clearOverlays()
          const newMk = new window.BMap.Marker(pt)
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
    if (!map || !window.BMap) return
    try {
      const geolocation = new window.BMap.Geolocation()
      geolocation.getCurrentPosition(
        (r: any) => {
          if (r) {
            const pt = r.point
            map.clearOverlays()
            map.centerAndZoom(pt, 16)
            const newMk = new window.BMap.Marker(pt)
            newMk.enableDragging()
            map.addOverlay(newMk)
            setMarker(newMk)
            setSelectedLat(pt.lat)
            setSelectedLng(pt.lng)
            const addr = r.address
            if (addr) {
              const addrStr = `${addr.city}${addr.district}${addr.street}${addr.streetNumber}`
              setSelectedAddress(addrStr)
              setSearchText(addrStr)
            } else {
              setSelectedAddress(`${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}`)
            }
          }
        },
        () => alert('定位失败，请检查定位权限'),
        { enableHighAccuracy: true }
      )
    } catch {
      alert('定位异常')
    }
  }

  // ==================== 确认 ====================
  const handleConfirm = () => {
    const addr = selectedAddress || searchText || `${selectedLat.toFixed(4)},${selectedLng.toFixed(4)}`
    onConfirm(addr, selectedLat, selectedLng)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">📍 选择位置</h3>
          <button onClick={onClose} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200">✕</button>
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
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearch()
                  }
                }}
                placeholder="搜索地址，如郑州东站..."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-orange-500"
              />

              {/* ===== POI 联想下拉面板 ===== */}
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

            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-orange-500 text-white text-sm rounded-xl hover:bg-orange-600 transition-all whitespace-nowrap"
            >
              搜索
            </button>
            <button
              onClick={handleLocate}
              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 transition-all whitespace-nowrap"
              title="定位当前位置"
            >
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
          <p className="text-xs text-slate-400 mt-0.5 ml-5">
            {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
          </p>
        </div>

        {/* 底部按钮 */}
        <div className="p-4 pt-2 flex gap-3 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200">
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
