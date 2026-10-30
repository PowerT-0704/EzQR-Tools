import path from 'node:path'
import { readFile } from 'node:fs/promises'
import type { ApiConfig, ApiStatus, QrOptions } from '../../shared/types'
import { AppError } from './errors'

interface DecodePayload {
  code?: number
  message?: string
  data?: {
    contents?: unknown[]
  }
}

async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit,
  timeoutMilliseconds: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMilliseconds)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new AppError('NETWORK_TIMEOUT', '请求超时，请检查网络后重试')
    }
    const detail = error instanceof Error ? error.message : String(error)
    throw new AppError('NETWORK_ERROR', `无法连接服务器，请检查网络连接（${detail}）`)
  } finally {
    clearTimeout(timer)
  }
}

export class CaoliaoApi {
  constructor(private readonly config: ApiConfig) {}

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'EzQR-Tools/7.3.0'
    }
    if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`
    return headers
  }

  private checkStatus(response: Response): void {
    if (response.status === 401 || response.status === 403) {
      throw new AppError(
        'API_AUTH',
        `接口密钥无效或权限不足（HTTP ${response.status}）`
      )
    }
    if (response.status === 414) {
      throw new AppError('CONTENT_TOO_LONG', '内容过长，服务器拒绝处理，请缩短文本后重试')
    }
    if (!response.ok) {
      throw new AppError('API_HTTP', `服务器返回异常（HTTP ${response.status}）`)
    }
  }

  async decodeImage(filePath: string): Promise<string[]> {
    let bytes: Buffer
    try {
      bytes = await readFile(filePath)
    } catch (error) {
      throw new AppError(
        'IMAGE_READ',
        `无法读取图片文件：${error instanceof Error ? error.message : String(error)}`
      )
    }

    return this.decodeBytes(bytes, path.basename(filePath))
  }

  async decodeBytes(bytes: Uint8Array, name: string): Promise<string[]> {
    if (!bytes.byteLength) throw new AppError('IMAGE_READ', '图片文件为空，请选择其他图片')
    const form = new FormData()
    form.append(
      'file',
      new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' }),
      path.basename(name) || 'QRCode.png'
    )

    const response = await fetchWithTimeout(
      `${this.config.baseUrl}/read-qr-code`,
      {
        method: 'POST',
        headers: this.headers(),
        body: form
      },
      90_000
    )
    this.checkStatus(response)

    let payload: DecodePayload
    try {
      payload = (await response.json()) as DecodePayload
    } catch {
      throw new AppError('API_INVALID_RESPONSE', '服务器返回内容无法解析')
    }
    if (payload.code !== 0) {
      throw new AppError(
        'DECODE_FAILED',
        `解码失败：${payload.message || '未知错误'}`
      )
    }
    const contents = payload.data?.contents ?? []
    if (!Array.isArray(contents)) {
      throw new AppError('API_INVALID_RESPONSE', '服务器返回的二维码内容格式无效')
    }
    return contents.map((item) => String(item))
  }

  async generateQr(
    content: string,
    qr: QrOptions,
    timeoutMilliseconds = 30_000
  ): Promise<Buffer> {
    if (!content.trim()) throw new AppError('EMPTY_CONTENT', '二维码内容不能为空')

    const params = new URLSearchParams({
      data: content,
      format: 'png',
      error_correction: qr.errorCorrection,
      border: String(qr.border),
      size: `${qr.size}x${qr.size}`
    })
    const response = await fetchWithTimeout(
      `${this.config.baseUrl}/create-qr-code?${params.toString()}`,
      { method: 'GET', headers: this.headers() },
      timeoutMilliseconds
    )
    this.checkStatus(response)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!bytes.byteLength) {
      throw new AppError('EMPTY_RESPONSE', '服务器返回了空数据，请稍后重试')
    }
    if (!bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      throw new AppError('INVALID_IMAGE', '服务器返回的数据不是有效 PNG 图片')
    }
    return bytes
  }

  async checkConnection(): Promise<ApiStatus> {
    try {
      await this.generateQr(
        'EzQR-Tools',
        { size: 64, errorCorrection: 'L', border: 1 },
        Math.max(10_000, this.config.timeoutSeconds * 1000)
      )
      return {
        ok: true,
        message: this.config.apiKey
          ? '已连接（密钥模式，接口正常）'
          : '已连接（免密钥模式）',
        checkedAt: new Date().toISOString()
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : '接口检测失败',
        checkedAt: new Date().toISOString()
      }
    }
  }
}

