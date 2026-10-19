import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'

const executablePath = process.env.QRTOOL_PACKAGED_EXECUTABLE

test('the packaged Windows app generates, saves and records a QR code offline', async () => {
  test.skip(!executablePath, '设置 QRTOOL_PACKAGED_EXECUTABLE 后验收 win-unpacked 产物')
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'ezqr-packaged-e2e-'))
  const savedFile = path.join(dataRoot, 'packaged-offline.png')
  let electronApp: ElectronApplication | undefined
  try {
    await mkdir(path.join(dataRoot, 'config'))
    await writeFile(path.join(dataRoot, 'config', 'config.json'), JSON.stringify({
      schemaVersion: 2,
      api: { baseUrl: 'http://127.0.0.1:1/v1', apiKey: '', timeoutSeconds: 10 },
      qr: { engine: 'local', size: 1024, errorCorrection: 'M', border: 2 }
    }))
    electronApp = await electron.launch({
      executablePath,
      args: [],
      env: {
        ...process.env,
        QRTOOL_DATA_ROOT: dataRoot,
        QRTOOL_USER_DATA_DIR: path.join(dataRoot, 'electron-userdata')
      }
    })
    await electronApp.evaluate(({ app, dialog }, filePath) => {
      if (!app.isPackaged) throw new Error('当前启动的不是打包产物')
      if (app.getVersion() !== '7.1.0') throw new Error(`打包版本不正确：${app.getVersion()}`)
      const state = globalThis as typeof globalThis & { qrPackagedNetworkAttempts?: string[] }
      state.qrPackagedNetworkAttempts = []
      globalThis.fetch = (async (input) => {
        state.qrPackagedNetworkAttempts?.push(String(input))
        throw new TypeError('打包验收：网络不可用')
      }) as typeof fetch
      dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as typeof dialog.showSaveDialog
    }, savedFile)
    const page = await electronApp.firstWindow()
    await page.context().route(/^https?:\/\//, (route) => route.abort())
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.waitForSelector('.app-shell')
    await page.getByRole('tab', { name: '文本生成' }).click()
    const content = '安装包离线验证：中文 🧪\nhttps://example.com/packaged-offline'
    await page.locator('textarea.content-input').fill(content)
    await page.getByRole('button', { name: '生成二维码', exact: true }).click()
    await expect(page.getByAltText('生成的二维码')).toBeVisible()
    await page.getByRole('button', { name: '下载二维码' }).click()
    await expect.poll(() => stat(savedFile).then(() => true, () => false)).toBe(true)
    const png = PNG.sync.read(await readFile(savedFile))
    expect([png.width, png.height]).toEqual([1024, 1024])
    expect(jsQR(Uint8ClampedArray.from(png.data), png.width, png.height)?.data).toBe(content)
    const history = await page.evaluate(() => window.qrTool.getHistory())
    expect(history.find((item) => item.content === content)?.savedPath).toBe(savedFile)
    const networkAttempts = await electronApp.evaluate(() => {
      const state = globalThis as typeof globalThis & { qrPackagedNetworkAttempts?: string[] }
      return state.qrPackagedNetworkAttempts ?? []
    })
    expect(networkAttempts.filter((url) => /create-qr-code|read-qr-code/.test(url))).toEqual([])
    expect(errors).toEqual([])
  } finally {
    await electronApp?.close()
    const temporaryRoot = path.resolve(os.tmpdir()) + path.sep
    if (!path.resolve(dataRoot).startsWith(temporaryRoot) || !path.basename(dataRoot).startsWith('ezqr-packaged-e2e-')) {
      throw new Error('拒绝清理临时目录以外的路径')
    }
    await rm(dataRoot, { recursive: true, force: true })
  }
})
