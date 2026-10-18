import type { QrToolApi } from '../shared/types'

declare global {
  interface Window {
    qrTool: QrToolApi
  }
}

export {}

