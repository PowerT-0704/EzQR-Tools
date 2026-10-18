import { AppError } from './errors'

export function validateExternalUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError('EXTERNAL_URL_INVALID', '链接地址为空')
  }

  let parsed: URL
  try {
    parsed = new URL(value.trim())
  } catch {
    throw new AppError('EXTERNAL_URL_INVALID', '链接地址格式无效')
  }

  if (parsed.protocol !== 'https:') {
    throw new AppError('EXTERNAL_URL_PROTOCOL', '仅支持安全的 HTTPS 链接')
  }
  if (parsed.username || parsed.password) {
    throw new AppError('EXTERNAL_URL_INVALID', '链接中不能包含登录凭据')
  }
  return parsed.toString()
}
