import { describe, expect, it, vi } from 'vitest'
import {
  checkForLatestRelease,
  compareVersions,
  isAllowedReleaseUrl,
  parseVersion
} from '../src/main/services/update-service'

function releaseResponse(
  overrides: Record<string, unknown> = {},
  status = 200
): Response {
  return new Response(
    JSON.stringify({
      tag_name: 'v7.1.0',
      html_url: 'https://github.com/PowerT-0704/EzQR-Tools/releases/tag/v7.1.0',
      published_at: '2026-10-18T02:00:00Z',
      draft: false,
      prerelease: false,
      ...overrides
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

describe('update service', () => {
  it('parses and compares semantic version tags', () => {
    expect(parseVersion('v7.1.2')).toEqual([7, 1, 2])
    expect(parseVersion('7.0.0-beta.1')).toEqual([7, 0, 0])
    expect(parseVersion('latest')).toBeNull()
    expect(compareVersions('7.1.0', '7.0.9')).toBe(1)
    expect(compareVersions('7.0.0', 'v7.0.0')).toBe(0)
    expect(compareVersions('6.9.9', '7.0.0')).toBe(-1)
  })

  it('accepts only HTTPS release links from the project repository', () => {
    expect(
      isAllowedReleaseUrl(
        'https://github.com/PowerT-0704/EzQR-Tools/releases/tag/v7.1.0'
      )
    ).toBe(true)
    expect(
      isAllowedReleaseUrl(
        'http://github.com/PowerT-0704/EzQR-Tools/releases/tag/v7.1.0'
      )
    ).toBe(false)
    expect(
      isAllowedReleaseUrl(
        'https://github.com/other-user/other-repo/releases/tag/v7.1.0'
      )
    ).toBe(false)
  })

  it('returns an available update for a newer GitHub release', async () => {
    const fetchImpl = vi.fn(async () => releaseResponse())
    const result = await checkForLatestRelease({
      currentVersion: '7.0.0',
      apiUrl: 'https://example.test/releases/latest',
      fetchImpl
    })

    expect(result.status).toBe('available')
    expect(result.latestVersion).toBe('7.1.0')
    expect(result.message).toContain('发现新版本')
    expect(result.releaseUrl).toContain('/releases/tag/v7.1.0')
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('reports the current version when GitHub has no newer release', async () => {
    const result = await checkForLatestRelease({
      currentVersion: '7.0.0',
      fetchImpl: async () => releaseResponse({ tag_name: 'v7.0.0' })
    })

    expect(result.status).toBe('upToDate')
    expect(result.latestVersion).toBe('7.0.0')
    expect(result.message).toBe('已是最新版本')
  })

  it('rejects malformed release metadata and repository links', async () => {
    const malformedVersion = await checkForLatestRelease({
      currentVersion: '7.0.0',
      fetchImpl: async () => releaseResponse({ tag_name: 'nightly' })
    })
    const malformedUrl = await checkForLatestRelease({
      currentVersion: '7.0.0',
      fetchImpl: async () =>
        releaseResponse({
          html_url: 'https://example.com/PowerT-0704/EzQR-Tools/releases/tag/v7.1.0'
        })
    })

    expect(malformedVersion.status).toBe('error')
    expect(malformedUrl.status).toBe('error')
    expect(malformedVersion.message).toContain('版本信息无效')
  })

  it('maps missing releases and GitHub rate limits to Chinese errors', async () => {
    const missing = await checkForLatestRelease({
      currentVersion: '7.0.0',
      fetchImpl: async () => releaseResponse({}, 404)
    })
    const limited = await checkForLatestRelease({
      currentVersion: '7.0.0',
      fetchImpl: async () => releaseResponse({}, 403)
    })

    expect(missing.message).toBe('暂未发布可用版本')
    expect(limited.message).toContain('请求过于频繁')
  })

  it('handles malformed JSON and network failures', async () => {
    const malformed = await checkForLatestRelease({
      currentVersion: '7.0.0',
      fetchImpl: async () => new Response('not-json', { status: 200 })
    })
    const offline = await checkForLatestRelease({
      currentVersion: '7.0.0',
      fetchImpl: async () => {
        throw new TypeError('network down')
      }
    })

    expect(malformed.message).toContain('无法解析')
    expect(offline.message).toContain('确认网络连接')
  })

  it('reports request timeouts separately', async () => {
    const result = await checkForLatestRelease({
      currentVersion: '7.0.0',
      fetchImpl: async () => {
        throw new DOMException('The operation was aborted.', 'AbortError')
      }
    })

    expect(result.status).toBe('error')
    expect(result.message).toContain('检查更新超时')
  })
})
