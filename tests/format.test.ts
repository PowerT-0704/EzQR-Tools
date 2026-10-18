import { describe, expect, it } from 'vitest'
import { truncateContent, truncateMiddle } from '../src/shared/format'

describe('format helpers', () => {
  it('keeps short values intact', () => {
    expect(truncateMiddle('C:\\short\\qr.png')).toBe('C:\\short\\qr.png')
    expect(truncateContent('hello')).toBe('hello')
  })

  it('truncates long values with a marker', () => {
    const result = truncateContent('x'.repeat(2100), 2000)
    expect(result).toContain('仅显示前 2000 字符')
    expect(truncateMiddle('x'.repeat(100), 30)).toContain('…')
  })
})

