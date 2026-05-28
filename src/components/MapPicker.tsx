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

  useEffect(() => {
    if (!open || !window.BMap || !mapRef.current) return

    // 初始化地图
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

      setSelectedLat(pt.lat)
      setSelectedLng(pt.lng)
      // 逆地理编码获取地址
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
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // 搜索
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
  }

  const handleConfirm = () => {
    onConfirm(selectedAddress, selectedLat, selectedLng)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">📍 选择配送地址</h3>
          <button onClick={onClose} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200">✕</button>
        </div>

        {/* 搜索栏 */}
        <div className="p-4 pb-0">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="搜索地址，如天河城..."
              className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-orange-500"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-orange-500 text-white text-sm rounded-xl hover:bg-orange-600 transition-all"
            >
              搜索
            </button>
          </div>
        </div>

        {/* 地图区域 */}
        <div className="p-4 flex-1">
          <div ref={mapRef} className="w-full h-[300px] rounded-xl" />
        </div>

        {/* 选中地址信息 */}
        <div className="px-4 pb-2">
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
