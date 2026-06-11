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

  // ==================== 搜索并定位到目标地址 ====================
  const searchPoiAndLocate = (keyword: string) => {
    if (!map || !mountedRef.current) return
    try {
      const local = new (window as any).BMap.LocalSearch('', {
        pageCapacity: 1,
        onSearchComplete: (results: any) => {
          if (!mountedRef.current) return
          if (results.getCurrentNumPois() > 0) {
            const poi = results.getPoi(0)
            const pt = poi.point
            console.log('🎯 [SEARCH] 搜索定位到:', poi.title, pt.lat, pt.lng)
            map.clearOverlays()
            map.centerAndZoom(pt, 17)
            const newMk = new (window as any).BMap.Marker(pt)
            newMk.enableDragging()
            map.addOverlay(newMk)
            setMarker(newMk)
            setSelectedLat(pt.lat)
            setSelectedLng(pt.lng)
            setSelectedAddress(poi.address || poi.title)
            setSearchText(poi.title)
          } else {
            alert(`未找到“${keyword}”，请尝试手动搜索`)
          }
        },
      })
      local.search(keyword)
    } catch (err) {
      console.error('❌ [SEARCH] 搜索异常:', err)
    }
  }

  // ==================== 当前定位（双源竞争 + 异常地址自动回退）====================
  const handleLocate = () => {
    if (!map || !(window as any).BMap || !mountedRef.current) return

    let settled = false

    const applyPosition = (lat: number, lng: number, source: string) => {
      if (!mountedRef.current || settled) return
      settled = true
      console.log('🎯 [LOCATE] 选用来源:', source, '坐标:', lat, lng)

      convertToBd09(lat, lng).then((bdCoord) => {
        if (!mountedRef.current) return
        const { lat: bdLat, lng: bdLng } = bdCoord

        // 先定位到地图上
        map!.clearOverlays()
        map!.centerAndZoom(new (window as any).BMap.Point(bdLng, bdLat), 17)
        const newMk = new (window as any).BMap.Marker(new (window as any).BMap.Point(bdLng, bdLat))
        newMk.enableDragging()
        map!.addOverlay(newMk)
        setMarker(newMk)
        setSelectedLat(bdLat)
        setSelectedLng(bdLng)

        // 逆地理编码，判断地址是否可信
        getLocationWithGuard(bdLng, bdLat, (rs: any) => {
          if (!mountedRef.current) return
          const addComp = rs?.addressComponents
          if (!addComp) {
            setSelectedAddress(`${bdLat.toFixed(4)}, ${bdLng.toFixed(4)}`)
            return
          }
          const baseArea = `${addComp.province || ''}${addComp.city || ''}${addComp.district || ''}`.replace(/undefined/gi, '')
          const primaryPoi = rs?.surroundingPois?.[0]
          const poiTitle = primaryPoi?.title || ''
          const fullAddr = baseArea + (poiTitle || `${addComp.street || ''}${addComp.streetNumber || ''}`)
          const finalAddr = fullAddr.replace(/undefined/gi, '').trim() || `${bdLat.toFixed(4)}, ${bdLng.toFixed(4)}`

          // 检查地址是否有明显的问题特征
          // 1. 地址名以小区/广场/商场结尾（典型运营商 IP 定位特征）
          // 2. 逆地理编码返回的 POI 只有街道级别，没有具体建筑
          const suspiciousPatterns = /(豪都|小区|广场|大厦|购物中心|商业街|步行街|建材市场|批发市场)$/
          const isSuspicious = suspiciousPatterns.test(poiTitle) || (!poiTitle && source === 'BMapSDK')

          if (isSuspicious) {
            console.log('🔍 [LOCATE] 定位地址不可信 (' + poiTitle + ')，尝试周边搜索就近建筑')
            // 用坐标搜索附近 POI，取第一个非可疑建筑
            nearbySearch(bdLat, bdLng, (nearbyPoi) => {
              if (mountedRef.current && nearbyPoi) {
                console.log('🏢 [LOCATE] 就近建筑:', nearbyPoi.title, nearbyPoi.address)
                setSelectedAddress(nearbyPoi.address || nearbyPoi.title)
                setSearchText(nearbyPoi.title)
                map!.centerAndZoom(new (window as any).BMap.Point(nearbyPoi.lng, nearbyPoi.lat), 17)
                map!.clearOverlays()
                const nk = new (window as any).BMap.Marker(new (window as any).BMap.Point(nearbyPoi.lng, nearbyPoi.lat))
                nk.enableDragging()
                map!.addOverlay(nk)
                setMarker(nk)
                setSelectedLat(nearbyPoi.lat)
                setSelectedLng(nearbyPoi.lng)
              } else {
                // 附近搜不到更好建筑，先用原地址，提示可拖拽微调
                setSelectedAddress(finalAddr)
                setSearchText(finalAddr)
              }
            })
          } else {
            setSelectedAddress(finalAddr)
            setSearchText(finalAddr)
          }
        })
      })
    }

    // 附近搜索：取第一个 POI 中排除可疑建筑的
    const nearbySearch = (lat: number, lng: number, cb: (poi?: any) => void) => {
      try {
        const local = new (window as any).BMap.LocalSearch('', {
          pageCapacity: 5,
          onSearchComplete: (results: any) => {
            for (let i = 0; i < results.getCurrentNumPois(); i++) {
              const p = results.getPoi(i)
              // 跳过小区/广场等不可信 POI
              if (!/(住宅|家属院|小区|公寓|大厦|广场)$/.test(p.title)) {
                cb({
                  title: p.title,
                  address: p.address,
                  lat: p.point.lat,
                  lng: p.point.lng,
                })
                return
              }
            }
            cb() // 无可信 POI
          },
        })
        // 用坐标反向搜索周边建筑
        local.searchNearby('', new (window as any).BMap.Point(lng, lat), 300)
      } catch { cb() }
    }

    // 源1：HTML5 GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!mountedRef.current || settled) return
          const acc = pos.coords.accuracy || Infinity
          console.log('📡 [GPS] HTML5 返回, accuracy:', acc, '坐标:', pos.coords.latitude, pos.coords.longitude)
          if (acc <= 500) {
            applyPosition(pos.coords.latitude, pos.coords.longitude, 'GPS(' + acc.toFixed(0) + 'm)')
          }
        },
        (err) => {
          console.warn('⚠️ [GPS] HTML5 失败:', err.code, err.message)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    }

    // 源2：百度 SDK Geolocation（含 Wi-Fi 指纹）
    try {
      const geolocation = new (window as any).BMap.Geolocation()
      geolocation.enableSDKLocation()
      geolocation.getCurrentPosition(
        function (this: any, r: any) {
          if (!mountedRef.current || settled) return
          if (this.getStatus() === (window as any).BMAP_STATUS_SUCCESS) {
            const pt = r.point
            console.log('📡 [SDK] 百度 SDK 定位成功, 坐标:', pt.lat, pt.lng)
            applyPosition(pt.lat, pt.lng, 'BMapSDK')
          } else {
            console.warn('⚠️ [SDK] 百度 SDK 定位失败, 状态:', this.getStatus())
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    } catch (err) {
      console.warn('⚠️ [SDK] 百度 SDK 定位异常:', err)
    }

    // 兜底：12 秒后如果都没结果，提示用户手动搜索
    setTimeout(() => {
      if (!mountedRef.current || settled) return
      console.warn('⏰ [LOCATE] 双源定位均超时，提示用户手动搜索')
      alert('自动定位超时，请在搜索框中输入地址或在地图上点击选择')
    }, 12000)
  }

  // ==================== 蓝色定位按钮专属强刷：跳过一切缓存/防抖/并发控制，硬件级重新捕获 ====================
  const handleForceLocationRefresh = () => {
    if (!map || !(window as any).BMap || !mountedRef.current) return
    console.log('📡 [FORCE_LOCATION] 用户触发蓝色定位按钮，开始执行硬件级强刷，跳过缓存拦截...')

    // 1. 物理清除当前可能引发死锁的旧地理位置缓存痕迹
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith('geo_cache_')) {
          localStorage.removeItem(key)
        }
      })
      console.log('🧹 [FORCE_LOCATION] 已清除所有 geo_cache_ 缓存')
    } catch {}

    // 2. 调度百度原生高精度定位模块
    try {
      const geolocation = new (window as any).BMap.Geolocation()
      geolocation.getCurrentPosition(
        function (this: any, r: any) {
          if (!mountedRef.current) return
          // 检查是否由于网络原因或者拒绝权限导致失败
          if (this.getStatus() !== (window as any).BMAP_STATUS_SUCCESS) {
            console.error('❌ 百度 Geolocation 核心服务调取失败，状态码:', this.getStatus())
            alert('无法获取当前硬件定位，请检查浏览器/手机位置权限是否开启')
            return
          }

          // 捕获最新动态坐标，彻底粉碎硬编码默认值
          const freshLng = r.point.lng
          const freshLat = r.point.lat
          console.log('🎯 [GPS_SUCCESS] 捕获当前最新未污染坐标: lng=' + freshLng + ', lat=' + freshLat)

          // 3. 强制出网反查地标字面（完全绕过 getLocationWithGuard，直接调用百度 Geocoder）
          const geoc = new (window as any).BMap.Geocoder()
          geoc.getLocation(
            new (window as any).BMap.Point(freshLng, freshLat),
            function (rs: any) {
              if (!mountedRef.current) return
              if (!rs) {
                setSelectedAddress(freshLat.toFixed(4) + ', ' + freshLng.toFixed(4))
                setSearchText(freshLat.toFixed(4) + ', ' + freshLng.toFixed(4))
                return
              }

              const addComp = rs.addressComponents
              // 提取精准的三位一体路名（市区 + 街道 + 地标名称）
              const baseArea = [addComp.province, addComp.city, addComp.district].filter(Boolean).join('')
              const streetPart = [addComp.street, addComp.streetNumber].filter(Boolean).join('')
              const primaryPoi = rs.surroundingPois?.[0]
              const poiTitle = primaryPoi?.title || ''
              const cleanAddressText = baseArea + (poiTitle || streetPart)
              const finalText = cleanAddressText.replace(/undefined/gi, '').trim() || (freshLat.toFixed(4) + ', ' + freshLng.toFixed(4))

              // 4. 同步咬合状态机，强行扭转输入框与地图视角
              setSearchText(finalText)
              setSelectedAddress(finalText)
              setSelectedLat(freshLat)
              setSelectedLng(freshLng)

              if (map) {
                const newPoint = new (window as any).BMap.Point(freshLng, freshLat)
                map.centerAndZoom(newPoint, 16)
                map.clearOverlays()
                const mk = new (window as any).BMap.Marker(newPoint)
                mk.enableDragging()
                map.addOverlay(mk)
                setMarker(mk)
              }

              console.log('✅ [FORCE_LOCATION_COMPLETE] 蓝色按钮定位强刷流程闭环，死锁彻底解除！地址:', finalText)
            },
            { poiRadius: 100, numPois: 5 }
          )
        },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    } catch (err) {
      console.error('❌ [FORCE_LOCATION] 定位异常:', err)
      alert('定位异常，请检查位置权限后重试')
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
            <button onClick={handleForceLocationRefresh} className="px-4 py-2 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 transition-all whitespace-nowrap" title="定位当前位置">
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
