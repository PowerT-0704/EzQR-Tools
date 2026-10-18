/** Format a locale-independent, second-resolution desktop clock. */
export function formatClock(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function truncateMiddle(value: string, max = 72): string {
  if (value.length <= max) return value
  const half = Math.max(8, Math.floor((max - 1) / 2))
  return `${value.slice(0, half)}…${value.slice(-half)}`
}

export function truncateContent(value: string, max = 2000): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}\n…（内容过长，仅显示前 ${max} 字符）`
}

