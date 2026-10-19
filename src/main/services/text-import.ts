import path from 'node:path'
import { spawn } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { unzipSync } from 'fflate'
import { XMLParser } from 'fast-xml-parser'
import { MAX_TEXT_FILE_BYTES } from '../../shared/constants'

const PLAIN_TEXT_SUFFIXES = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.log',
  '.csv',
  '.tsv',
  '.json',
  '.xml',
  '.html',
  '.htm',
  '.ini',
  '.cfg',
  '.yml',
  '.yaml',
  '.sql',
  '.bat',
  '.cmd',
  '.ps1',
  '.py',
  '.js',
  '.css'
])
const OFFICE_SUFFIXES = new Set(['.docx', '.docm', '.odt'])
const SUPPORTED_SUFFIXES = new Set([
  ...PLAIN_TEXT_SUFFIXES,
  ...OFFICE_SUFFIXES,
  '.doc',
  '.rtf'
])
const ENCODINGS = ['utf-8', 'gb18030', 'big5', 'windows-1252'] as const

export interface TextExtractionResult {
  ok: boolean
  text: string
  message: string
  name: string
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = new Uint8Array(bytes.length - 2)
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      swapped[index - 2] = bytes[index + 1] ?? 0
      swapped[index - 1] = bytes[index] ?? 0
    }
    return new TextDecoder('utf-16le').decode(swapped)
  }
  for (const encoding of ENCODINGS) {
    try {
      return new TextDecoder(encoding, { fatal: true }).decode(bytes)
    } catch {
      // 尝试下一种常见编码。
    }
  }
  return new TextDecoder('utf-8').decode(bytes)
}

function stripRtf(bytes: Uint8Array): string {
  let text = new TextDecoder('latin1').decode(bytes)
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  )
  text = text.replace(/\\u(-?\d+)\??/g, (_, value: string) =>
    String.fromCharCode(Number(value) % 65536)
  )
  text = text.replace(/\{\\\*.*?\}/gs, '')
  text = text.replace(/\\par[d]?\b/g, '\n')
  text = text.replace(/\\line\b/g, '\n')
  text = text.replace(/\\tab\b/g, '\t')
  text = text.replace(/\\[a-zA-Z]+-?\d* ?/g, '')
  text = text.replace(/\\\{/g, '{').replace(/\\\}/g, '}').replace(/\\\\/g, '\\')
  text = text.replace(/[{}]/g, '')
  return text.replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function parser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: true,
    removeNSPrefix: true,
    trimValues: false,
    parseTagValue: false
  })
}

function appendValue(value: unknown, output: string[]): void {
  if (value == null) return
  if (typeof value === 'string' || typeof value === 'number') {
    output.push(String(value))
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) appendValue(item, output)
    return
  }
  if (typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) {
      appendValue(child, output)
    }
  }
}

function appendParagraphs(node: unknown, output: string[]): void {
  if (node == null) return
  if (Array.isArray(node)) {
    for (const item of node) appendParagraphs(item, output)
    return
  }
  if (typeof node !== 'object') return
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === 'p') {
      const paragraphs = Array.isArray(value) ? value : [value]
      for (const paragraph of paragraphs) {
        const values: string[] = []
        appendValue(paragraph, values)
        output.push(values.join(''))
      }
    } else if (key !== '#text') {
      appendParagraphs(value, output)
    }
  }
}

function extractDocx(bytes: Uint8Array): string {
  const files = unzipSync(bytes)
  const document = files['word/document.xml']
  if (!document) throw new Error('文档缺少 word/document.xml')
  const parsed = parser().parse(new TextDecoder('utf-8').decode(document)) as unknown
  const paragraphs: string[] = []
  appendParagraphs(parsed, paragraphs)
  return paragraphs.join('\n')
}

function extractOdt(bytes: Uint8Array): string {
  const files = unzipSync(bytes)
  const content = files['content.xml']
  if (!content) throw new Error('文档缺少 content.xml')
  const parsed = parser().parse(new TextDecoder('utf-8').decode(content)) as unknown
  const paragraphs: string[] = []
  appendParagraphs(parsed, paragraphs)
  return paragraphs.join('\n')
}

async function runPowerShell(command: string, timeout = 60_000): Promise<string> {
  const encoded = Buffer.from(command, 'utf16le').toString('base64')
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
      {
        windowsHide: true,
        env: { ...process.env }
      }
    )
    const chunks: Buffer[] = []
    const errors: Buffer[] = []
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('读取 Word 文档超时'))
    }, timeout)
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => errors.push(chunk))
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error(Buffer.concat(errors).toString('utf8') || 'Word 调用失败'))
        return
      }
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
  })
}

async function extractDoc(filePath: string): Promise<string> {
  const script = [
    "$ErrorActionPreference='Stop'",
    '[Console]::OutputEncoding=[Text.Encoding]::UTF8',
    '$word=New-Object -ComObject Word.Application',
    '$word.Visible=$false',
    'try {',
    '  $doc=$word.Documents.Open($env:QRTOOL_DOC_PATH,$false,$true)',
    '  $text=$doc.Content.Text',
    '  $doc.Close($false)',
    '  Write-Output $text',
    '} finally {',
    '  $word.Quit()',
    '}'
  ].join(';')
  const previous = process.env.QRTOOL_DOC_PATH
  process.env.QRTOOL_DOC_PATH = filePath
  try {
    return await runPowerShell(script)
  } finally {
    if (previous === undefined) delete process.env.QRTOOL_DOC_PATH
    else process.env.QRTOOL_DOC_PATH = previous
  }
}

export async function extractText(filePath: string): Promise<TextExtractionResult> {
  const target = path.resolve(filePath)
  const name = path.basename(target)
  const suffix = path.extname(target).toLowerCase()
  if (!SUPPORTED_SUFFIXES.has(suffix)) {
    return {
      ok: false,
      text: '',
      message: `暂不支持 ${suffix || '该'} 格式，可选：txt / md / json / docx / odt 等`,
      name
    }
  }
  try {
    const info = await stat(target)
    if (!info.isFile()) {
      return { ok: false, text: '', message: `文件不存在：${target}`, name }
    }
    if (info.size > MAX_TEXT_FILE_BYTES) {
      return {
        ok: false,
        text: '',
        message: `文件过大（${(info.size / 1024 / 1024).toFixed(1)} MB），请精简到 5 MB 以内`,
        name
      }
    }
    let text: string
    if (suffix === '.doc') {
      text = await extractDoc(target)
    } else {
      const bytes = new Uint8Array(await readFile(target))
      if (suffix === '.rtf') text = stripRtf(bytes)
      else if (suffix === '.docx' || suffix === '.docm') text = extractDocx(bytes)
      else if (suffix === '.odt') text = extractOdt(bytes)
      else text = decodeText(bytes)
    }
    text = normalizeText(text)
    if (!text.trim()) {
      return { ok: false, text: '', message: '文件内容为空或无法提取文字', name }
    }
    return { ok: true, text, message: '', name }
  } catch (error) {
    const hint =
      suffix === '.doc'
        ? '未能读取 .doc（需要本机安装 Word），建议另存为 .docx 或 .txt 后重试'
        : `读取失败：${error instanceof Error ? error.message : String(error)}`
    return { ok: false, text: '', message: hint, name }
  }
}

