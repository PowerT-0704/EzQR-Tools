import { readFile } from 'node:fs/promises'

const FALLBACK_ANNOUNCEMENT = `# 开发公告

**当前版本：v7.4.0**

易码 EzQR-Tools 是来自 CDUT 的二维码解析与生成工具。本地生码和重构新增透明 PNG 与 SVG，独立“透明与矢量”工作区支持 PNG 去白底、转 SVG 和一步转换。
`

export class AnnouncementStore {
  constructor(private readonly filePath: string) {}

  async read(): Promise<string> {
    try {
      const content = await readFile(this.filePath, 'utf8')
      return content.trim() ? content : FALLBACK_ANNOUNCEMENT
    } catch {
      return FALLBACK_ANNOUNCEMENT
    }
  }
}

