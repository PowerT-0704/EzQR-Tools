import type { ApiConfig, QrOptions } from '../../shared/types'
import { CaoliaoApi } from './caoliao-api'
import type { EngineHealth, ImageBytes, QrCodeEngine } from './qr-code-engine'
import { validateQrOptions } from './qr-code-engine'

export class CaoliaoQrEngine implements QrCodeEngine {
  readonly id = 'caoliao' as const
  readonly supportsDecode = true
  private readonly api: CaoliaoApi

  constructor(config: ApiConfig) {
    this.api = new CaoliaoApi(config)
  }

  encode(content: string, options: QrOptions): Promise<Buffer> {
    return this.api.generateQr(content, validateQrOptions(options))
  }

  decode(image: ImageBytes): Promise<string[]> {
    return this.api.decodeBytes(image.bytes, image.name)
  }

  async health(): Promise<EngineHealth> {
    const result = await this.api.checkConnection()
    return {
      ok: result.ok === true,
      message: result.message,
      checkedAt: result.checkedAt ?? new Date().toISOString()
    }
  }
}
