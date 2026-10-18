import { describe, expect, it } from 'vitest'
import { validateExternalUrl } from '../src/main/services/external-links'

describe('external link validation', () => {
  it('accepts HTTPS links', () => {
    expect(validateExternalUrl('https://example.com/docs')).toBe(
      'https://example.com/docs'
    )
  })

  it('rejects insecure HTTP links', () => {
    expect(() => validateExternalUrl('http://example.com')).toThrow(
      '仅支持安全的 HTTPS 链接'
    )
  })

  it('rejects local files and custom protocols', () => {
    expect(() => validateExternalUrl('file:///C:/secret.txt')).toThrow(
      '仅支持安全的 HTTPS 链接'
    )
    expect(() => validateExternalUrl('javascript:alert(1)')).toThrow(
      '仅支持安全的 HTTPS 链接'
    )
  })

  it('rejects invalid URLs and embedded credentials', () => {
    expect(() => validateExternalUrl('not a url')).toThrow('链接地址格式无效')
    expect(() => validateExternalUrl('https://user:pass@example.com')).toThrow(
      '链接中不能包含登录凭据'
    )
  })
})

