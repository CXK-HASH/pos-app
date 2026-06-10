/**
 * 百度地图 API 防抖拦截器
 * 
 * 防止高频渲染时对百度地图 Geocoder 造成并发轰炸
 * 使用 localStorage 10 分钟缓存 + 相同坐标命中拦截
 */

const CACHE_TTL = 10 * 60 * 1000 // 10 分钟

interface GeoCachePayload {
  addressComponents: any
  business: string
  surroundingPois: any[]
}

/**
 * 包装后的逆地理编码函数，带防抖+缓存拦截
 * @param lng 经度
 * @param lng 经度
 * @param lat 纬度
 * @param callback 成功回调
 * @param onError 可选错误回调
 */
export function getLocationWithGuard(
  lng: number,
  lat: number,
  callback: (rs: any) => void,
  onError?: (err: any) => void
) {
  if (!lng || !lat) return

  const cacheKey = `geo_cache_${lng.toFixed(4)}_${lat.toFixed(4)}`
  const now = Date.now()

  try {
    const cachedData = localStorage.getItem(cacheKey)
    const cacheTimestamp = localStorage.getItem(`${cacheKey}_time`)

    // 命中10分钟缓存 → 直接截留
    if (cachedData && cacheTimestamp && now - Number(cacheTimestamp) < CACHE_TTL) {
      console.log('🛡️ [BAIDU_API_GUARD] 命中本地缓存（10min TTL）:', cacheKey)
      try {
        callback(JSON.parse(cachedData))
      } catch (e) {
        // 缓存格式异常，放行
        localStorage.removeItem(cacheKey)
        localStorage.removeItem(`${cacheKey}_time`)
      }
      return
    }

    // 放行 → 调用百度 API
    const geoc = new (window as any).BMap.Geocoder()
    geoc.getLocation(
      new (window as any).BMap.Point(lng, lat),
      (rs: any) => {
        try {
          const payload: GeoCachePayload = {
            addressComponents: rs.addressComponents,
            business: rs.business,
            surroundingPois: rs.surroundingPois || [],
          }
          localStorage.setItem(cacheKey, JSON.stringify(payload))
          localStorage.setItem(`${cacheKey}_time`, now.toString())
        } catch (e) {
          // localStorage 写满等场景静默失败
        }
        callback(rs)
      },
      { poiRadius: 150, numPois: 12 }
    )
  } catch (e) {
    // localStorage 不可用时降级
    const geoc = new (window as any).BMap.Geocoder()
    geoc.getLocation(
      new (window as any).BMap.Point(lng, lat),
      callback,
      { poiRadius: 150, numPois: 12 }
    )
  }
}
