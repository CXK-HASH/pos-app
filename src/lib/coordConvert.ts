/**
 * 坐标转换工具
 * WGS-84（手机 GPS 原生坐标）↔ BD-09（百度地图坐标）
 * 
 * 百度地图使用 BD-09 坐标系，手机 navigator.geolocation 返回的是 WGS-84
 * 直接混用会导致几十公里的漂移误差。
 * 
 * 提供两种转换方式：
 * 1. 百度 SDK BMap.Convertor 转换（在线优先）
 * 2. 纯数学算法转换（离线兜底）
 */

const PI = Math.PI
const X_PI = (PI * 3000.0) / 180.0
const A = 6378245.0 // 长半轴
const EE = 0.00669342162296594323 // 偏心率的平方

// ==================== 纯数学转换（GCJ-02 ↔ BD-09） ====================

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320.0 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0
  return ret
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0
  return ret
}

/**
 * WGS-84 → GCJ-02（国测局火星坐标）
 */
export function wgs84ToGcj02(wgsLat: number, wgsLng: number): { lat: number; lng: number } {
  // 中国境外不偏移
  if (wgsLng < 72.004 || wgsLng > 137.8347 || wgsLat < 0.8293 || wgsLat > 55.8271) {
    return { lat: wgsLat, lng: wgsLng }
  }
  let dLat = transformLat(wgsLng - 105.0, wgsLat - 35.0)
  let dLng = transformLng(wgsLng - 105.0, wgsLat - 35.0)
  const radLat = (wgsLat / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI)
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI)
  return { lat: wgsLat + dLat, lng: wgsLng + dLng }
}

/**
 * GCJ-02 → BD-09
 */
export function gcj02ToBd09(gcjLat: number, gcjLng: number): { lat: number; lng: number } {
  const z = Math.sqrt(gcjLng * gcjLng + gcjLat * gcjLat) + 0.00002 * Math.sin(gcjLat * X_PI)
  const theta = Math.atan2(gcjLat, gcjLng) + 0.000003 * Math.cos(gcjLng * X_PI)
  return { lat: z * Math.sin(theta), lng: z * Math.cos(theta) }
}

/**
 * WGS-84 → BD-09（一步到位）
 * 手机 GPS 原生坐标 → 百度坐标系
 */
export function wgs84ToBd09(wgsLat: number, wgsLng: number): { lat: number; lng: number } {
  const gcj = wgs84ToGcj02(wgsLat, wgsLng)
  return gcj02ToBd09(gcj.lat, gcj.lng)
}

/**
 * WGS-84 → BD-09（内置百度 SDK + 数学算法双保险）
 * 
 * - 优先使用百度 SDK 的 Convertor（在线、精确）
 * - SDK 不可用时降级到纯数学算法（离线 99.9% 精度）
 */
export function convertToBd09(
  wgsLat: number,
  wgsLng: number
): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    // 先尝试百度 SDK
    if (typeof window !== 'undefined' && (window as any).BMap?.Convertor) {
      try {
        const point = new (window as any).BMap.Point(wgsLng, wgsLat)
        const convertor = new (window as any).BMap.Convertor()
        convertor.translate([point], 1, 5, (data: any) => {
          if (data?.status === 0 && data.points?.[0]) {
            const bp = data.points[0]
            console.log('🔄 [COORD_CONVERT] SDK转换成功: WGS-84 -> BD-09', {
              from: `${wgsLat.toFixed(6)},${wgsLng.toFixed(6)}`,
              to: `${bp.lat.toFixed(6)},${bp.lng.toFixed(6)}`,
            })
            resolve({ lat: bp.lat, lng: bp.lng })
            return
          }
          // SDK 转换失败，降级到数学算法
          console.warn('⚠️ [COORD_CONVERT] SDK转换失败, status:', data?.status, '降级到数学算法')
          const fallback = wgs84ToBd09(wgsLat, wgsLng)
          resolve(fallback)
        })
        return
      } catch (e) {
        console.warn('⚠️ [COORD_CONVERT] SDK异常:', e, '降级到数学算法')
      }
    }
    // SDK 不可用，使用数学算法
    const result = wgs84ToBd09(wgsLat, wgsLng)
    console.log('🔄 [COORD_CONVERT] 数学算法转换: WGS-84 -> BD-09', {
      from: `${wgsLat.toFixed(6)},${wgsLng.toFixed(6)}`,
      to: `${result.lat.toFixed(6)},${result.lng.toFixed(6)}`,
    })
    resolve(result)
  })
}
