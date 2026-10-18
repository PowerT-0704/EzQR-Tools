import {
  GITHUB_LATEST_RELEASE_API_URL,
  UPDATE_CHECK_TIMEOUT_MS
} from '../../shared/constants'
import type { UpdateInfo } from '../../shared/types'

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>

interface GitHubReleasePayload {
  tag_name?: unknown
  html_url?: unknown
  published_at?: unknown
  draft?: unknown
  prerelease?: unknown
}

export interface UpdateCheckOptions {
  currentVersion: string
  apiUrl?: string
  fetchImpl?: FetchImplementation
  timeoutMs?: number
}

function checkedAt(): string {
  return new Date().toISOString()
}

function errorInfo(currentVersion: string, message: string): UpdateInfo {
  return {
    status: 'error',
    currentVersion,
    message,
    checkedAt: checkedAt()
  }
}

export function parseVersion(value: unknown): [number, number, number] | null {
  if (typeof value !== 'string') return null
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/i.exec(value.trim())
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function compareVersions(left: string, right: string): number {
  const leftVersion = parseVersion(left)
  const rightVersion = parseVersion(right)
  if (!leftVersion || !rightVersion) throw new Error('版本号格式无效')
  const [leftMajor, leftMinor, leftPatch] = leftVersion
  const [rightMajor, rightMinor, rightPatch] = rightVersion
  if (leftMajor !== rightMajor) return leftMajor > rightMajor ? 1 : -1
  if (leftMinor !== rightMinor) return leftMinor > rightMinor ? 1 : -1
  if (leftPatch !== rightPatch) return leftPatch > rightPatch ? 1 : -1
  return 0
}

export function isAllowedReleaseUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      /^\/PowerT-0704\/EzQR-Tools\/releases\/tag\/[^/]+\/?$/.test(url.pathname)
    )
  } catch {
    return false
  }
}

function isTimeoutError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

export async function checkForLatestRelease({
  currentVersion,
  apiUrl = GITHUB_LATEST_RELEASE_API_URL,
  fetchImpl = fetch,
  timeoutMs = UPDATE_CHECK_TIMEOUT_MS
}: UpdateCheckOptions): Promise<UpdateInfo> {
  try {
    const response = await fetchImpl(apiUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `EzQR-Tools/${currentVersion}`
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs)
    })

    if (response.status === 404) {
      return errorInfo(currentVersion, '暂未发布可用版本')
    }
    if (response.status === 403 || response.status === 429) {
      return errorInfo(currentVersion, 'GitHub 请求过于频繁，请稍后再试')
    }
    if (!response.ok) {
      return errorInfo(currentVersion, `检查更新失败（HTTP ${response.status}）`)
    }

    let payload: GitHubReleasePayload
    try {
      payload = (await response.json()) as GitHubReleasePayload
    } catch {
      return errorInfo(currentVersion, 'GitHub 返回的版本信息无法解析')
    }

    if (payload.draft === true || payload.prerelease === true) {
      return errorInfo(currentVersion, 'GitHub 返回的版本信息无效')
    }

    const latestVersion = parseVersion(payload.tag_name)
    if (
      !latestVersion ||
      !isAllowedReleaseUrl(payload.html_url)
    ) {
      return errorInfo(currentVersion, 'GitHub 返回的版本信息无效')
    }

    const normalizedLatest = latestVersion.join('.')
    const hasUpdate = compareVersions(normalizedLatest, currentVersion) > 0
    return {
      status: hasUpdate ? 'available' : 'upToDate',
      currentVersion,
      latestVersion: normalizedLatest,
      releaseUrl: payload.html_url,
      publishedAt:
        typeof payload.published_at === 'string' ? payload.published_at : undefined,
      message: hasUpdate
        ? `发现新版本 v${normalizedLatest}`
        : '已是最新版本',
      checkedAt: checkedAt()
    }
  } catch (error) {
    if (isTimeoutError(error)) {
      return errorInfo(currentVersion, '检查更新超时，请稍后再试')
    }
    return errorInfo(currentVersion, '暂时无法检查更新，请确认网络连接')
  }
}
