/**
 * 哈弗辛公式计算两点之间球面距离
 * @returns 距离（千米），保留一位小数
 */
export function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const PI = Math.PI
  const EARTH_RADIUS = 6378.137 // km
  const radLat1 = (lat1 * PI) / 180.0
  const radLat2 = (lat2 * PI) / 180.0
  const a = radLat1 - radLat2
  const b = (lng1 * PI) / 180.0 - (lng2 * PI) / 180.0
  let s = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin(a / 2), 2) + Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(b / 2), 2)
  ))
  s = s * EARTH_RADIUS
  return Math.round(s * 10) / 10
}

/**
 * 格式化距离显示
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`
  return `${km.toFixed(1)}km`
}
