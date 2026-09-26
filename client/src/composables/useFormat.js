/**
 * 字节与时间格式化工具
 *
 * 抽取前项目内有 7 处 formatBytes/formatSize、5 处 formatTime 的重复实现，
 * 且各处行为存在真实差异（空值占位、单位集、时间格式）。因此这里保留选项参数，
 * 保证替换后各页面的显示效果与替换前完全一致。
 */

/** 默认单位集（部分页面历史上只到 GB） */
export const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB']
export const BYTE_UNITS_NO_TB = ['B', 'KB', 'MB', 'GB']

/**
 * 格式化字节数（1024 进制，保留 1 位小数）
 *
 * @param {number} bytes
 * @param {{ empty?: string, units?: string[] }} [options]
 *   - empty: 空值（null / undefined / 0 / NaN）时的占位文本，默认 '0 B'
 *   - units: 单位集，默认到 TB
 */
export function formatBytes(bytes, options = {}) {
  const { empty = '0 B', units = BYTE_UNITS } = options
  if (!bytes) return empty
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i]
}

/**
 * 格式化时间
 *
 * @param {string|number|Date} iso
 * @param {{ empty?: string, locale?: boolean }} [options]
 *   - empty: 空值时的占位文本，默认 '--'
 *   - locale: true 使用 toLocaleString('zh-CN', { hour12: false })；
 *             false 使用固定的 YYYY-MM-DD HH:mm
 */
export function formatTime(iso, options = {}) {
  const { empty = '--', locale = false } = options
  if (!iso) return empty

  const date = new Date(iso)

  if (locale) {
    try {
      return date.toLocaleString('zh-CN', { hour12: false })
    } catch {
      return String(iso)
    }
  }

  if (Number.isNaN(date.getTime())) return String(iso)

  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** composable 形式的便捷封装，用法与 useMobile 保持一致 */
export function useFormat() {
  return { formatBytes, formatTime }
}
