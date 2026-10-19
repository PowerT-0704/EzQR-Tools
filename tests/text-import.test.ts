import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { extractText } from '../src/main/services/text-import'

const directories: string[] = []

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'qrtool-text-'))
  directories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe('text import', () => {
  it('reads UTF-8 plain text and normalizes line endings', async () => {
    const directory = await temporaryDirectory()
    const file = path.join(directory, 'sample.txt')
    await writeFile(file, '\ufeff第一行\r\n第二行', 'utf8')
    const result = await extractText(file)
    expect(result.ok).toBe(true)
    expect(result.text).toBe('第一行\n第二行')
  })

  it('preserves leading and trailing whitespace when importing content', async () => {
    const directory = await temporaryDirectory()
    const file = path.join(directory, 'whitespace.txt')
    await writeFile(file, '  原始文本\r\n保留空白  \n ', 'utf8')
    const result = await extractText(file)
    expect(result.ok).toBe(true)
    expect(result.text).toBe('  原始文本\n保留空白  \n ')
  })

  it('rejects a whitespace-only document without treating it as QR content', async () => {
    const directory = await temporaryDirectory()
    const file = path.join(directory, 'empty.txt')
    await writeFile(file, '  \r\n\t ', 'utf8')
    const result = await extractText(file)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('内容为空')
  })

  it('extracts every docx run and paragraph', async () => {
    const directory = await temporaryDirectory()
    const file = path.join(directory, 'sample.docx')
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>第一段</w:t></w:r></w:p>
          <w:p><w:r><w:t>第二</w:t></w:r><w:r><w:t>段</w:t></w:r></w:p>
        </w:body>
      </w:document>`
    await writeFile(file, zipSync({ 'word/document.xml': strToU8(xml) }))
    const result = await extractText(file)
    expect(result.ok).toBe(true)
    expect(result.text).toBe('第一段\n第二段')
  })

  it('extracts ODT paragraphs', async () => {
    const directory = await temporaryDirectory()
    const file = path.join(directory, 'sample.odt')
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
        xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
        <office:body><office:text>
          <text:p>第一段</text:p>
          <text:p>第二段</text:p>
        </office:text></office:body>
      </office:document-content>`
    await writeFile(file, zipSync({ 'content.xml': strToU8(xml) }))
    const result = await extractText(file)
    expect(result.ok).toBe(true)
    expect(result.text).toBe('第一段\n第二段')
  })

  it('strips RTF controls', async () => {
    const directory = await temporaryDirectory()
    const file = path.join(directory, 'sample.rtf')
    await writeFile(file, '{\\rtf1\\ansi Hello\\par World}', 'latin1')
    const result = await extractText(file)
    expect(result.ok).toBe(true)
    expect(result.text).toBe('Hello\nWorld')
  })

  it('rejects unsupported files', async () => {
    const directory = await temporaryDirectory()
    const file = path.join(directory, 'sample.exe')
    await writeFile(file, 'x')
    const result = await extractText(file)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('暂不支持')
  })
})

