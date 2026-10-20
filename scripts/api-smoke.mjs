import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const imagePath =
  process.argv[2] || 'X:\\收款码\\二维码_wxp___f2f030Up5QseLR.png'
const baseUrl = (process.env.QRTOOL_API_BASE_URL || 'https://api.2dcode.biz/v1').replace(
  /\/+$/,
  ''
)
const apiKey = (process.env.QRTOOL_API_KEY || '').trim()
const headers = { 'User-Agent': 'EzQR-Tools/7.2.0' }
if (apiKey) headers.Authorization = `Bearer ${apiKey}`

async function decode(filePath) {
  const bytes = await readFile(filePath)
  const form = new FormData()
  form.append('file', new Blob([bytes]), path.basename(filePath))
  const response = await fetch(`${baseUrl}/read-qr-code`, {
    method: 'POST',
    headers,
    body: form
  })
  if (!response.ok) throw new Error(`Decode HTTP ${response.status}`)
  const payload = await response.json()
  if (payload.code !== 0) throw new Error(`Decode failed: ${payload.message || payload.code}`)
  return (payload.data?.contents || []).map(String)
}

async function generate(content) {
  const params = new URLSearchParams({
    data: content,
    size: '1024x1024',
    format: 'png',
    error_correction: 'M',
    border: '2'
  })
  const response = await fetch(`${baseUrl}/create-qr-code?${params}`, { headers })
  if (!response.ok) throw new Error(`Generate HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (!bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    throw new Error('Generate response is not a PNG')
  }
  return bytes
}

const directory = await mkdtemp(path.join(os.tmpdir(), 'qrtool-api-smoke-'))
try {
  console.log('[1/3] decoding', imagePath)
  const contents = await decode(imagePath)
  if (!contents.length) throw new Error('No QR code was detected')
  console.log('      content:', contents[0])

  console.log('[2/3] regenerating')
  const output = path.join(directory, 'rebuilt.png')
  const bytes = await generate(contents[0])
  await writeFile(output, bytes)
  console.log('      saved:', output, `(${bytes.length} bytes)`)

  console.log('[3/3] decoding the rebuilt image')
  const rebuiltContents = await decode(output)
  if (rebuiltContents[0] !== contents[0]) {
    throw new Error('Rebuilt QR content does not match')
  }
  console.log('PASS: rebuilt QR content matches the original')
} finally {
  await rm(directory, { recursive: true, force: true })
}

