'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    BMap: any
    BMapLib: any
  }
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
  const [selectedAddress, setSelectedAddress] = useState(initialAddress || '天河城')
  const [selectedLat, setSelectedLat] = useState(initialLat || 23.128)
  const [selectedLng, setSelectedLng] = useState(initialLng || 113.262)
  const [searchText, setSearchText] = useState(initialAddress || '')
  const [locating, setLocating] = useState(false)

  // 初始化地图 + Autocomplete
  useEffect(() => {
    if (!open || !window.BMap || !mapRef.current) return

    const defaultPoint = new window.BMap.Point(selectedLng, selectedLat)
    const bm = new window.BMap.Map(mapRef.current)
    bm.centerAndZoom(defaultPoint, 15)
    bm.enableScrollWheelZoom(true)
    bm.addControl(new window.BMap.NavigationControl())

    // 初始标点
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
      updateFromPoint(pt)
    })

    // 拖拽结束
    mk.addEventListener('dragend', (e: any) => {
      const pt = e.point
      updateFromPoint(pt)
    })

    setMap(bm)

    // === 初始化 Autocomplete 输入智能提示 ===
    const ac = new window.BMap.Autocomplete({
      input: 'mapPickerSuggestInput',
      location: bm,
    })

    ac.addEventListener('onconfirm', (e: any) => {
      const _value = e.item.value
      const myValue = `${_value.province}${_value.city}${_value.district}${_value.street}${_value.business}`.trim()

      if (!myValue) return

      // 用 LocalSearch 获取精确坐标
      const local = new window.BMap.LocalSearch(bm, {
        onSearchComplete: () => {
          const results = local.getResults()
          if (results?.getNumPois() > 0) {
            const poi = results.getPoi(0)
            const pt = poi.point
            bm.clearOverlays()
            const newMk = new window.BMap.Marker(pt)
            newMk.enableDragging()
            bm.addOverlay(newMk)
            setMarker(newMk)
            bm.centerAndZoom(pt, 18)
            setSearchText(poi.title || myValue)
            updateFromPoint(pt)
          }
        },
      })
      local.search(myValue)
    })

    return () => {
      bm.destroy()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // 逆地理编码更新状态
  const updateFromPoint = (pt: any) => {
    setSelectedLat(pt.lat)
    setSelectedLng(pt.lng)
    const gc = new window.BMap.Geocoder()
    gc.getLocation(pt, (rs: any) => {
      if (rs) {
        // 优先用 surroundingPois
        const building = rs.surroundingPois?.[0]?.title || rs.address
        setSelectedAddress(building)
      } else {
        setSelectedAddress(`${pt.lat.toFixed(4)},${pt.lng.toFixed(4)}`)
      }
    })
  }

  // 🎯 自动定位当前位置
  const handleLocate = () => {
    if (!navigator.geolocation || !map) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        const pt = new window.BMap.Point(longitude, latitude)
        map.clearOverlays()
        const newMk = new window.BMap.Marker(pt)
        newMk.enableDragging()
        map.addOverlay(newMk)
        setMarker(newMk)
        map.centerAndZoom(pt, 18)

        // 逆地理编码
        const gc = new window.BMap.Geocoder()
        gc.getLocation(pt, (rs: any) => {
          if (rs) {
            const addComp = rs.addressComponents
            const building = rs.surroundingPois?.[0]?.title || `${addComp.district}${addComp.street}${addComp.streetNumber}`
            setSelectedAddress(building)
          } else {
            setSelectedAddress(`${latitude.toFixed(4)},${longitude.toFixed(4)}`)
          }
        })
        setSelectedLat(latitude)
        setSelectedLng(longitude)
        setSearchText('')
        setLocating(false)
      },
      () => {
        setLocating(false)
        alert('定位失败，请检查定位权限设置')
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  // 搜索按钮兜底
  const handleSearch = () => {
    if (!map || !searchText.trim()) return
    const local = new window.BMap.LocalSearch(map, {
      onSearchComplete: (results: any) => {
        if (results?.getNumPois() > 0) {
          const poi = results.getPoi(0)
          const pt = poi.point
          map.clearOverlays()
          const newMk = new window.BMap.Marker(pt)
          newMk.enableDragging()
          map.addOverlay(newMk)
          setMarker(newMk)
          map.centerAndZoom(pt, 18)
          setSelectedLat(pt.lat)
          setSelectedLng(pt.lng)
          setSelectedAddress(poi.address || poi.title)
        }
      },
    })
    local.search(searchText.trim())
  }

  const handleConfirm = () => {
    onConfirm(selectedAddress, selectedLat, selectedLng)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">📍 选择配送地址</h3>
          <button onClick={onClose} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200">✕</button>
        </div>

        {/* 搜索栏 + 定位按钮 */}
        <div className="p-4 pb-2">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                id="mapPickerSuggestInput"
                ref={inputRef}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="搜索地址，如天河城..."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-orange-500"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-orange-500 text-white text-sm rounded-xl hover:bg-orange-600 transition-all shrink-0"
            >
              搜索
            </button>
          </div>
          {/* 🎯 定位当前位置按钮 */}
          <button
            onClick={handleLocate}
            disabled={locating}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full hover:bg-blue-100 transition-all disabled:opacity-50"
          >
            {locating ? '📍 定位中...' : '🎯 定位当前位置'}
          </button>
        </div>

        {/* 地图区域 */}
        <div className="px-4 flex-1">
          <div ref={mapRef} className="w-full h-[320px] rounded-xl" />
        </div>

        {/* 选中地址信息 */}
        <div className="px-4 pb-2 mt-2">
          <p className="text-sm text-slate-500">
            <span className="text-orange-500">📍</span> 当前选中：
            <span className="text-slate-800 font-medium ml-1">{selectedAddress}</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5 ml-5">
            {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
          </p>
        </div>

        {/* 底部 */}
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
