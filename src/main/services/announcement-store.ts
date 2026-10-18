import { readFile } from 'node:fs/promises'

const FALLBACK_ANNOUNCEMENT = `# 开发公告

**当前版本：v7.0.0**

易码 EzQR-Tools 是来自 CDUT 的二维码解析与生成工具。
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

