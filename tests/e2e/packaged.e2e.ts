import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'

const executablePath = process.env.QRTOOL_PACKAGED_EXECUTABLE

test('the packaged Windows app decodes, rebuilds, saves and generates offline', async () => {
  test.skip(!executablePath, '设置 QRTOOL_PACKAGED_EXECUTABLE 后验收 win-unpacked 产物')
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'ezqr-packaged-e2e-'))
  const savedFile = path.join(dataRoot, 'packaged-offline.png')
  const sourceImage = path.join(dataRoot, 'packaged-source.webp')
  const rebuiltFile = path.join(dataRoot, 'packaged-source_rebuild.png')
  let electronApp: ElectronApplication | undefined
  try {
    await mkdir(path.join(dataRoot, 'config'))
    await writeFile(sourceImage, await readFile(path.join(import.meta.dirname, '..', 'fixtures', 'decode', 'sample.webp')))
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
    await electronApp.evaluate(({ app, dialog }, paths) => {
      if (!app.isPackaged) throw new Error('当前启动的不是打包产物')
      if (process.versions.electron !== '44.9.1') throw new Error(`Electron 安全修复版本不正确：${process.versions.electron}`)
      if (app.getVersion() !== '7.3.0') throw new Error(`打包版本不正确：${app.getVersion()}`)
      const state = globalThis as typeof globalThis & { qrPackagedNetworkAttempts?: string[] }
      state.qrPackagedNetworkAttempts = []
      globalThis.fetch = (async (input) => {
        state.qrPackagedNetworkAttempts?.push(String(input))
        throw new TypeError('打包验收：网络不可用')
      }) as typeof fetch
      dialog.showSaveDialog = (async () => ({ canceled: false, filePath: paths.savedFile })) as typeof dialog.showSaveDialog
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [paths.sourceImage] })) as typeof dialog.showOpenDialog
    }, { savedFile, sourceImage })
    const page = await electronApp.firstWindow()
    await page.context().route(/^https?:\/\//, (route) => route.abort())
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.waitForSelector('.app-shell')
    const sourceContent = '  易码本地解析 🧪\nhttps://example.com/offline\n  '
    await page.evaluate(() => window.qrTool.updateSettings({ qr: { engine: 'caoliao', size: 128, errorCorrection: 'H', border: 16 } }))
    await page.getByRole('tab', { name: '二维码解析', exact: true }).click()
    await page.getByRole('button', { name: '选择二维码图片', exact: true }).click()
    await expect(page.locator('.decode-task .status-pill.success')).toContainText('解析完成')
    expect(await page.locator('.decode-task .decode-output').textContent()).toBe(sourceContent)
    await page.getByRole('button', { name: '复制二维码 1 内容', exact: true }).click()
    expect(await electronApp.evaluate(({ clipboard }) => clipboard.readText())).toBe(sourceContent)
    await expect(page.getByRole('button', { name: '检测接口', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '下载二维码', exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => window.qrTool.getHistory())).toEqual([])
    expect(await stat(rebuiltFile).then(() => true, () => false)).toBe(false)
    await expect(page.getByAltText('待解析的二维码原图')).toBeVisible()
    await page.screenshot({ path: 'test-results/v7.3-packaged-decode.png' })
    await page.evaluate(() => window.qrTool.updateSettings({ qr: { engine: 'local', size: 1024, errorCorrection: 'M', border: 2 } }))
    await page.getByRole('tab', { name: '图片重构' }).click()
    await page.getByRole('button', { name: '选择二维码图片', exact: true }).click()
    await expect(page.locator('.status-pill.success')).toContainText('重构完成')
    expect(await page.locator('.decode-output').textContent()).toBe(sourceContent)
    const rebuiltPng = PNG.sync.read(await readFile(rebuiltFile))
    expect([rebuiltPng.width, rebuiltPng.height]).toEqual([1024, 1024])
    expect(jsQR(Uint8ClampedArray.from(rebuiltPng.data), rebuiltPng.width, rebuiltPng.height)?.data).toBe(sourceContent)
    // Re-decode the actual saved file through the packaged application.
    await electronApp.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [filePath] })) as typeof dialog.showOpenDialog
    }, rebuiltFile)
    await page.getByRole('button', { name: '选择二维码图片', exact: true }).click()
    await expect.poll(async () => (await page.evaluate(() => window.qrTool.getHistory())).filter((item) => item.type === 'rebuild').length).toBe(2)
    await expect(page.locator('.status-pill.success')).toContainText('重构完成')
    expect(await page.locator('.decode-output').textContent()).toBe(sourceContent)
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
    expect(history.filter((item) => item.content === sourceContent && item.type === 'rebuild')).toHaveLength(2)
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
