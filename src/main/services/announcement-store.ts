import { readFile } from 'node:fs/promises'

const FALLBACK_ANNOUNCEMENT = `# 开发公告

**当前版本：v7.3.0**

易码 EzQR-Tools 是来自 CDUT 的二维码解析与生成工具。新增独立“二维码解析”，始终本地解码，只显示内容，不重构、不保存、不写历史。
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

