'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    BMap: any
  }
}

interface NavigationMapProps {
  open: boolean
  onClose: () => void
  merchantName: string
  fromLat: number
  fromLng: number
  toAddress: string
  toLat: number
  toLng: number
}

export default function NavigationMap({
  open, onClose, merchantName,
  fromLat, fromLng, toAddress, toLat, toLng,
}: NavigationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [routeInfo, setRouteInfo] = useState<string>('')

  useEffect(() => {
    if (!open || !window.BMap || !mapRef.current) return

    const start = new window.BMap.Point(fromLng, fromLat)
    const end = new window.BMap.Point(toLng, toLat)

    // viewport 包含起终点
    const bs = new window.BMap.Bounds(start, end)
    const viewCenter = new window.BMap.Point(
      (fromLng + toLng) / 2,
      (fromLat + toLat) / 2
    )

    const bm = new window.BMap.Map(mapRef.current)
    bm.centerAndZoom(viewCenter, 14)
    bm.enableScrollWheelZoom(true)

    // 添加起终点标记
    const startMk = new window.BMap.Marker(start, { icon: new window.BMap.Icon(
      'https://api.map.baidu.com/images/start-point.png', new window.BMap.Size(25, 35), { anchor: new window.BMap.Size(12, 35) }
    )})
    const endMk = new window.BMap.Marker(end, { icon: new window.BMap.Icon(
      'https://api.map.baidu.com/images/end-point.png', new window.BMap.Size(25, 35), { anchor: new window.BMap.Size(12, 35) }
    )})
    bm.addOverlay(startMk)
    bm.addOverlay(endMk)

    // 添加信息窗口
    const startLabel = new window.BMap.Label(`${merchantName}(起点)`, {
      position: start, offset: new window.BMap.Size(-30, -40),
    })
    startLabel.setStyle({ color: '#333', fontSize: '12px', padding: '2px 6px', background: '#fff', borderRadius: '4px', border: '1px solid #ddd' })
    bm.addOverlay(startLabel)

    const endLabel = new window.BMap.Label(`${toAddress}(终点)`, {
      position: end, offset: new window.BMap.Size(-30, -40),
    })
    endLabel.setStyle({ color: '#333', fontSize: '12px', padding: '2px 6px', background: '#fff', borderRadius: '4px', border: '1px solid #ddd' })
    bm.addOverlay(endLabel)

    // 骑行路线规划
    const riding = new window.BMap.RidingRoute(bm, {
      renderOptions: { map: bm, panel: 'route-panel', autoViewport: true },
      onSearchComplete: (results: any) => {
        if (results?.getNumLines() > 0) {
          const line = results.getLine(0)
          const distance = (line.distance / 1000).toFixed(1)
          const duration = Math.ceil(line.duration / 60)
          setRouteInfo(`🚴 ${distance} 公里 · 预计 ${duration} 分钟`)
        }
      },
    })
    riding.search(start, end)

    setMap(bm)

    return () => { bm.destroy() }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">🗺️ 配送导航路线</h3>
            {routeInfo && (
              <p className="text-orange-500 text-sm font-medium mt-0.5">{routeInfo}</p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200">✕</button>
        </div>

        {/* 起终点信息 */}
        <div className="px-4 pt-3 pb-0 flex items-center gap-2 text-sm text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            <span className="font-medium">{merchantName}</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-red-500 rounded-full"></span>
            <span className="font-medium">{toAddress}</span>
          </div>
        </div>

        {/* 地图 */}
        <div className="p-4 flex-1">
          <div ref={mapRef} className="w-full h-[400px] rounded-xl" />
        </div>

        {/* 路线面板 */}
        <div id="route-panel" className="px-4 pb-4 max-h-[200px] overflow-y-auto text-sm text-slate-600" />

        {/* 底部 */}
        <div className="p-4 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200">
            关闭导航
          </button>
        </div>
      </div>
    </div>
  )
}
