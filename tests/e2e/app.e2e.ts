import { createServer, type Server } from 'node:http'
import { mkdtemp, mkdir, readFile, rm, stat, truncate, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'
import type { QrSettings } from '../../src/shared/types'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Locator,
  type Page
} from '@playwright/test'

const projectRoot = path.resolve(import.meta.dirname, '..', '..')
const fixtureImage = path.join(projectRoot, 'tests', 'fixtures', 'qr-sample.png')
const decodeFixtures = path.join(projectRoot, 'tests', 'fixtures', 'decode')
const decodeContent = '  易码本地解析 🧪\nhttps://example.com/offline\n  '

let server: Server
let electronApp: ElectronApplication
let page: Page
let dataRoot: string
let outputRoot: string
let mockReleaseTag = 'v7.3.0'
const rendererErrors: string[] = []
const qrRequests: string[] = []

async function decodeSavedPng(filePath: string, expectedContent: string): Promise<PNG> {
  await expect.poll(() => stat(filePath).then(() => true, () => false)).toBe(true)
  const png = PNG.sync.read(await readFile(filePath))
  const decoded = jsQR(Uint8ClampedArray.from(png.data), png.width, png.height, {
    inversionAttempts: 'dontInvert'
  })
  expect(decoded?.data).toBe(expectedContent)
  return png
}

async function generateAndSave(content: string, fileName: string): Promise<PNG> {
  await page.getByRole('tab', { name: '文本生成' }).click()
  const preview = page.getByAltText('生成的二维码')
  const previousSource = (await preview.count()) ? await preview.getAttribute('src') : null
  await page.locator('textarea.content-input').fill(content)
  await page.getByRole('button', { name: '生成二维码', exact: true }).click()
  await expect(preview).toBeVisible()
  if (previousSource) await expect(preview).not.toHaveAttribute('src', previousSource)
  const savedFile = path.join(outputRoot, fileName)
  await overrideSaveDialog(savedFile)
  await page.getByRole('button', { name: '下载二维码' }).click()
  return decodeSavedPng(savedFile, content)
}

async function openQrSettings(): Promise<Locator> {
  await page.getByRole('button', { name: '软件设置' }).click()
  const dialog = page.getByRole('dialog', { name: '软件设置' })
  await dialog.locator('.settings-nav').getByRole('tab', { name: /接口与保存/ }).click()
  return dialog
}

async function configureQr(qr: QrSettings): Promise<void> {
  const dialog = await openQrSettings()
  await dialog.getByRole('group', { name: '处理引擎', exact: true }).getByRole('button', {
    name: qr.engine === 'local' ? '本地处理（离线）' : '草料在线',
    exact: true
  }).click()
  await setRange('二维码尺寸', qr.size)
  await setRange('边框', qr.border)
  await dialog.getByRole('group', { name: '纠错级别', exact: true }).getByRole('button', {
    name: qr.errorCorrection,
    exact: true
  }).click()
  await expect.poll(() => page.evaluate(async () => (await window.qrTool.bootstrap()).settings.qr)).toEqual(qr)
  await dialog.getByRole('button', { name: '完成', exact: true }).click()
}

async function setMainNetworkBlocked(blocked: boolean): Promise<void> {
  await electronApp.evaluate((_electron, shouldBlock) => {
    const state = globalThis as typeof globalThis & {
      qrE2eOriginalFetch?: typeof fetch
      qrE2eNetworkAttempts?: string[]
    }
    if (shouldBlock) {
      state.qrE2eOriginalFetch ??= globalThis.fetch
      state.qrE2eNetworkAttempts = []
      globalThis.fetch = (async (input) => {
        state.qrE2eNetworkAttempts?.push(String(input))
        throw new TypeError('E2E: 网络已断开')
      }) as typeof fetch
    } else if (state.qrE2eOriginalFetch) {
      globalThis.fetch = state.qrE2eOriginalFetch
      delete state.qrE2eOriginalFetch
    }
  }, blocked)
}

async function mainNetworkAttempts(): Promise<string[]> {
  return electronApp.evaluate(() => {
    const state = globalThis as typeof globalThis & { qrE2eNetworkAttempts?: string[] }
    return state.qrE2eNetworkAttempts ?? []
  })
}

async function startMockApi(): Promise<{ apiBaseUrl: string; updateApiUrl: string }> {
  server = createServer((request, response) => {
    if (request.url === '/github/latest-release') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      response.end(
        JSON.stringify({
          tag_name: mockReleaseTag,
          html_url: `https://github.com/PowerT-0704/EzQR-Tools/releases/tag/${mockReleaseTag}`,
          published_at: '2026-10-18T02:00:00Z',
          draft: false,
          prerelease: false
        })
      )
      return
    }
    if (request.url?.startsWith('/v1/create-qr-code')) {
      qrRequests.push(request.url)
      const url = new URL(request.url, 'http://127.0.0.1')
      void QRCode.toBuffer(url.searchParams.get('data') ?? '', {
        width: Number(url.searchParams.get('size')?.split('x')[0] ?? 1024),
        errorCorrectionLevel: (url.searchParams.get('error_correction') ?? 'M') as 'L' | 'M' | 'Q' | 'H',
        margin: Number(url.searchParams.get('border') ?? 2)
      }).then((png) => {
        response.writeHead(200, { 'Content-Type': 'image/png' })
        response.end(png)
      }, () => {
        response.writeHead(400)
        response.end('编码失败')
      })
      return
    }
    if (request.method === 'POST' && request.url === '/v1/read-qr-code') {
      qrRequests.push(request.url)
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      response.end(
        JSON.stringify({
          code: 0,
          message: 'ok',
          data: { contents: ['https://example.com/plasma-e2e'] }
        })
      )
      return
    }
    response.writeHead(404)
    response.end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('模拟接口未能启动')
  return {
    apiBaseUrl: `http://127.0.0.1:${address.port}/v1`,
    updateApiUrl: `http://127.0.0.1:${address.port}/github/latest-release`
  }
}

async function overrideOpenDialog(targetPath: string): Promise<void> {
  await electronApp.evaluate(
    ({ dialog }, selectedPath) => {
      dialog.showOpenDialog = (async () => ({
        canceled: false,
        filePaths: [selectedPath]
      })) as typeof dialog.showOpenDialog
    },
    targetPath
  )
}

async function overrideSaveDialog(targetPath: string): Promise<void> {
  await electronApp.evaluate(
    ({ dialog }, selectedPath) => {
      dialog.showSaveDialog = (async () => ({
        canceled: false,
        filePath: selectedPath
      })) as typeof dialog.showSaveDialog
    },
    targetPath
  )
}

async function setRange(label: string, value: number): Promise<void> {
  await page.getByRole('slider', { name: label }).evaluate((element, nextValue) => {
    const input = element as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set
    setter?.call(input, String(nextValue))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

async function expectModalCloseHitbox(dialog: Locator): Promise<Locator> {
  const closeButton = dialog.locator('.modal-close-button')
  await expect(closeButton).toBeVisible()
  const box = await closeButton.boundingBox()
  expect(box).not.toBeNull()
  if (!box) throw new Error('关闭按钮没有可测量的命中区域')
  expect(box.width).toBeGreaterThanOrEqual(42)
  expect(box.height).toBeGreaterThanOrEqual(42)

  const points = [
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    { x: box.x + 5, y: box.y + 5 },
    { x: box.x + box.width - 5, y: box.y + 5 },
    { x: box.x + 5, y: box.y + box.height - 5 },
    { x: box.x + box.width - 5, y: box.y + box.height - 5 }
  ]
  for (const point of points) {
    expect(
      await page.evaluate(
        ({ x, y }) =>
          Boolean(document.elementFromPoint(x, y)?.closest('.modal-close-button')),
        point
      )
    ).toBe(true)
  }

  await page.mouse.move(8, 8)
  await page.waitForTimeout(260)
  const closeVisual = closeButton.locator('.modal-close-visual')
  const before = await closeVisual.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  )
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(260)
  const after = await closeVisual.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  )
  expect(after).not.toBe(before)
  return closeButton
}

test.beforeAll(async () => {
  dataRoot = await mkdtemp(path.join(os.tmpdir(), 'qrtool-e2e-'))
  outputRoot = path.join(dataRoot, 'output')
  await mkdir(path.join(dataRoot, 'config'), { recursive: true })
  await mkdir(outputRoot, { recursive: true })
  const mockApi = await startMockApi()
  await writeFile(
    path.join(dataRoot, 'config', 'config.json'),
    JSON.stringify(
      {
        schemaVersion: 2,
        api: { baseUrl: mockApi.apiBaseUrl, apiKey: '', timeoutSeconds: 10 },
        qr: { engine: 'local', size: 1024, errorCorrection: 'M', border: 2 },
        historyLimit: 50,
        appearance: {
          palette: 'mistBlue',
          backgroundImage: '',
          material: {
            backgroundBlur: 8,
            refraction: 1.05,
            dispersion: 0.55,
            highlight: 0.8,
            frost: 0.35,
            elevation: 0.2,
            viscosity: 0.5
          }
        },
        output: { mode: 'custom', directory: outputRoot }
      },
      null,
      2
    ),
    'utf8'
  )

  electronApp = await electron.launch({
    args: ['.'],
    cwd: projectRoot,
    env: {
      ...process.env,
      QRTOOL_DATA_ROOT: dataRoot,
      QRTOOL_USER_DATA_DIR: path.join(dataRoot, 'electron-userdata'),
      QRTOOL_UPDATE_API_URL: mockApi.updateApiUrl
    }
  })
  page = await electronApp.firstWindow()
  page.on('pageerror', (error) => rendererErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      rendererErrors.push(message.text())
      console.error('[renderer]', message.text())
    }
  })
  await page.waitForSelector('.app-shell')
  expect(await page.evaluate(async () => (await window.qrTool.bootstrap()).appVersion)).toBe('7.2.0')
})

test.afterAll(async () => {
  await electronApp?.close()
  await new Promise<void>((resolve) => server?.close(() => resolve()))
  await rm(dataRoot, { recursive: true, force: true })
})

test('renders the light two-workspace layout without fused surfaces', async () => {
  expect(qrRequests).toEqual([])
  await expect(page).toHaveTitle('易码 EzQR-Tools')
  await expect(page.getByText('易码 EzQR-Tools')).toBeVisible()
  const brandLogo = page.locator('.brand-logo')
  await expect(brandLogo).toBeVisible()
  expect(
    await brandLogo.evaluate((element) => (element as HTMLImageElement).naturalWidth)
  ).toBeGreaterThan(0)
  expect(await brandLogo.evaluate((element) => getComputedStyle(element).width)).toBe('40px')
  await expect(page.getByRole('tab', { name: '图片重构' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '文本生成' })).toBeVisible()
  await expect(page.getByRole('button', { name: /历史记录/ })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(237, 244, 255)')

  const navThumb = page.locator('.workspace-nav-thumb')
  const initialTransform = await navThumb.evaluate((element) => getComputedStyle(element).transform)
  await page.getByRole('tab', { name: '文本生成' }).click()
  await page.waitForTimeout(300)
  const nextTransform = await navThumb.evaluate((element) => getComputedStyle(element).transform)
  expect(nextTransform).not.toBe(initialTransform)
  await page.getByRole('tab', { name: '图片重构' }).click()

  const canvas = page.locator('canvas.plasma-ground')
  await expect(canvas).toBeVisible()
  const canvasSize = await canvas.evaluate((element) => ({
    width: (element as HTMLCanvasElement).width,
    height: (element as HTMLCanvasElement).height
  }))
  expect(canvasSize.width).toBeGreaterThan(500)
  expect(canvasSize.height).toBeGreaterThan(400)
  expect(await page.locator('.plasma-panel').count()).toBeLessThanOrEqual(12)
  const paddings = await page.evaluate(() => {
    const paddingTop = (selector: string): number => {
      const element = document.querySelector(selector)
      return element ? Number.parseFloat(getComputedStyle(element).paddingTop) : 0
    }
    return {
      task: paddingTop('.task-card'),
      nav: paddingTop('.workspace-nav'),
      preview: paddingTop('.preview-dock')
    }
  })
  expect(paddings.task).toBeGreaterThanOrEqual(22)
  expect(paddings.nav).toBeGreaterThanOrEqual(20)
  expect(paddings.preview).toBeGreaterThanOrEqual(20)
  const borders = await page.evaluate(() => {
    const borderTop = (selector: string): number => {
      const element = document.querySelector(selector)
      return element ? Number.parseFloat(getComputedStyle(element).borderTopWidth) : -1
    }
    return {
      nav: borderTop('.workspace-nav'),
      task: borderTop('.task-card'),
      preview: borderTop('.preview-dock'),
      footer: borderTop('.footerbar'),
      plasmaButton: borderTop('.titlebar .plasma-button'),
      windowButton: borderTop('.titlebar .window-button')
    }
  })
  Object.values(borders).forEach((border) => expect(border).toBe(0))

  const titlebar = page.locator('.titlebar')
  expect(await titlebar.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe('0px')
  expect(await titlebar.evaluate((element) => getComputedStyle(element).boxShadow)).toBe('none')
  const headerButton = page.getByRole('button', { name: '开发公告' })
  expect(
    await headerButton.evaluate((element) => getComputedStyle(element).borderTopWidth)
  ).toBe('0px')
  const restBackground = await headerButton.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  )
  await headerButton.hover()
  await page.waitForTimeout(180)
  const hoverBackground = await headerButton.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  )
  expect(hoverBackground).not.toBe(restBackground)
  expect(
    await headerButton.evaluate((element) => getComputedStyle(element).borderTopWidth)
  ).toBe('0px')
  await expect(page.getByRole('button', { name: '最小化' })).toHaveCSS('border-top-width', '0px')
  await expect(page.getByRole('button', { name: '最小化' })).toHaveCSS('box-shadow', 'none')
  expect(
    await page.locator('.workspace-nav-thumb').evaluate(
      (element) => getComputedStyle(element).backgroundImage
    )
  ).not.toBe('none')
  expect(await page.locator('.app-shell').innerText()).not.toContain(
    '二维码解析与生成工具'
  )
  expect(rendererErrors).toEqual([])
  await page.screenshot({ path: 'test-results/qrtool-light-rebuild.png' })
})

test('shows GitHub release updates and handles the latest-version state', async () => {
  const settingsButton = page.getByRole('button', { name: '软件设置' })
  await expect(settingsButton.locator('.update-indicator')).toBeVisible()
  await settingsButton.click()

  const settingsDialog = page.getByRole('dialog', { name: '软件设置' })
  await settingsDialog
    .locator('.settings-nav')
    .getByRole('tab', { name: /数据与关于/ })
    .click()
  await expect(settingsDialog.getByText('发现新版本 v7.3.0')).toBeVisible()
  await expect(
    settingsDialog.getByRole('button', { name: '查看 GitHub Release' })
  ).toBeEnabled()
  await expect(settingsDialog.getByText('最新版本 v7.3.0')).toBeVisible()
  await page.waitForTimeout(320)
  await page.screenshot({ path: 'test-results/qrtool-light-update.png' })

  mockReleaseTag = 'v7.2.0'
  await settingsDialog.getByRole('button', { name: '检查更新' }).click()
  await expect(settingsDialog.getByText('已是最新版本', { exact: true })).toBeVisible()
  await expect(settingsButton.locator('.update-indicator')).not.toBeVisible()
  await settingsDialog.getByRole('button', { name: '完成' }).click()
})

test('settings restyle the root Plasma canvas and persist', async () => {
  const settingsButton = page.getByRole('button', { name: '软件设置' })
  await settingsButton.click()
  await page.waitForTimeout(250)
  const dialog = page.getByRole('dialog', { name: '软件设置' })
  await expect(dialog).toBeVisible()
  await expectModalCloseHitbox(dialog)
  await expect(dialog).toHaveCSS('border-top-width', '0px')
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(settingsButton).toBeFocused()

  await settingsButton.click()
  await expect(dialog).toBeVisible()
  await expect(page.locator('.modal-root')).toHaveAttribute(
    'data-modal-backdrop',
    'palette'
  )

  await page.getByRole('button', { name: /樱花粉/ }).click()
  await expect(page.locator('.plasma-appearance')).toHaveAttribute('data-palette', 'sakuraPink')
  await page.screenshot({ path: 'test-results/qrtool-light-settings-appearance.png' })

  const settingsThumb = page.locator('.settings-nav-thumb')
  const firstThumbTransform = await settingsThumb.evaluate(
    (element) => getComputedStyle(element).transform
  )
  await dialog.locator('.settings-nav').getByRole('tab', { name: /玻璃材质/ }).click()
  await page.waitForTimeout(260)
  const secondThumbTransform = await settingsThumb.evaluate(
    (element) => getComputedStyle(element).transform
  )
  expect(secondThumbTransform).not.toBe(firstThumbTransform)
  expect(
    await settingsThumb.evaluate((element) => getComputedStyle(element).backgroundImage)
  ).not.toBe('none')
  await expect(page.getByText('实时材质预览')).toBeVisible()
  const closeButton = dialog.locator('.modal-close-button')
  await closeButton.focus()
  await setRange('背景模糊', 20)
  await expect(closeButton).toBeFocused()
  await setRange('边缘折射', 1.55)
  await expect(page.locator('.plasma-appearance')).toHaveAttribute('data-background-blur', '20')
  await expect(page.locator('.plasma-appearance')).toHaveAttribute('data-refraction', '1.55')
  await page.waitForTimeout(350)

  const persisted = await page.evaluate(async () => {
    const bootstrap = await window.qrTool.bootstrap()
    return bootstrap.settings.appearance
  })
  expect(persisted.palette).toBe('sakuraPink')
  expect(persisted.material.backgroundBlur).toBe(20)
  expect(persisted.material.refraction).toBe(1.55)
  await page.screenshot({ path: 'test-results/qrtool-light-settings.png' })

  await page.getByRole('button', { name: '恢复材质默认值' }).click()
  await dialog.locator('.settings-nav').getByRole('tab', { name: /接口与保存/ }).click()
  expect(
    await dialog.locator('.setting-panel').first().evaluate(
      (element) => getComputedStyle(element).borderTopWidth
    )
  ).toBe('0px')
  expect(
    await dialog.getByRole('button', { name: '保存' }).evaluate(
      (element) => getComputedStyle(element).borderTopWidth
    )
  ).toBe('0px')
  expect(
    await dialog.locator('.api-key-row input').evaluate(
      (element) => getComputedStyle(element).borderTopWidth
    )
  ).not.toBe('0px')
  await expect(
    dialog.getByRole('group', { name: '二维码保存模式', exact: true }).locator('button.active')
  ).toBeVisible()
  await page.screenshot({ path: 'test-results/qrtool-light-settings-api.png' })
  await dialog.locator('.settings-nav').getByRole('tab', { name: /数据与关于/ }).click()
  await page.screenshot({ path: 'test-results/qrtool-light-settings-data.png' })
  await dialog.locator('.settings-nav').getByRole('tab', { name: /外观与背景/ }).click()
  await page.getByRole('button', { name: /晨雾蓝/ }).click()
  await expect(page.locator('.plasma-appearance')).toHaveAttribute('data-palette', 'mistBlue')
  await page.waitForTimeout(250)
  await closeButton.click()
  await expect(dialog).not.toBeVisible()
})

test('rebuilds an image and shows it in the persistent preview dock', async () => {
  const previousRequests = qrRequests.length
  await overrideOpenDialog(fixtureImage)
  await page.getByRole('button', { name: '选择二维码图片' }).click()
  await expect(page.getByText('重构完成', { exact: false })).toBeVisible()
  await expect(page.getByText('wxp://f2f0lXAbpx9HDakSYhgZCO71HrkRlP7riDo7Qaf4ph0Bx2g')).toBeVisible()
  await expect(page.getByAltText('二维码重构预览')).toBeVisible()
  const rebuilt = path.join(outputRoot, 'qr-sample_rebuild.png')
  expect((await stat(rebuilt)).isFile()).toBe(true)
  await decodeSavedPng(rebuilt, 'wxp://f2f0lXAbpx9HDakSYhgZCO71HrkRlP7riDo7Qaf4ph0Bx2g')
  expect(qrRequests.slice(previousRequests)).toEqual([])

  await page.getByRole('button', { name: '原始图片' }).click()
  await expect(page.getByAltText('二维码重构预览')).toBeVisible()
  const previewThumb = page.locator('.preview-selector-thumb')
  await expect(previewThumb).toBeVisible()
  expect(
    await previewThumb.evaluate((element) => getComputedStyle(element).backgroundImage)
  ).not.toBe('none')
  await page.screenshot({ path: 'test-results/qrtool-light-rebuild-complete.png' })
})

test('generates, saves, imports and reuses history from the modal', async () => {
  await page.getByRole('tab', { name: '文本生成' }).click()
  const textArea = page.locator('textarea.content-input')
  expect(
    await textArea.evaluate((element) => getComputedStyle(element).borderTopWidth)
  ).not.toBe('0px')
  await textArea.fill('浅色液态玻璃二维码生成测试')
  await page.getByRole('button', { name: '生成二维码' }).click()
  await expect(page.getByAltText('生成的二维码')).toBeVisible()
  await expect(page.getByText('内容长度', { exact: false })).toBeVisible()

  const savedFile = path.join(outputRoot, 'QRCode.png')
  await overrideSaveDialog(savedFile)
  await page.getByRole('button', { name: '下载二维码' }).click()
  await expect(page.getByText('最近保存')).toBeVisible()
  expect((await stat(savedFile)).isFile()).toBe(true)
  await decodeSavedPng(savedFile, '浅色液态玻璃二维码生成测试')

  const importedText = path.join(dataRoot, 'import.txt')
  const importedContent = '  \n从文本文件读取的新内容 📄\n保留首尾空白  \n '
  await writeFile(importedText, importedContent, 'utf8')
  await overrideOpenDialog(importedText)
  await page.getByRole('button', { name: '从文本文件读取' }).click()
  await expect(textArea).toHaveValue(importedContent)
  await generateAndSave(importedContent, 'imported-whitespace.png')

  await page.locator('.history-toggle').click()
  const historyDialog = page.getByRole('dialog', { name: '历史记录' })
  await expect(historyDialog).toBeVisible()
  expect(
    await page.locator('.history-toggle').evaluate(
      (element) => getComputedStyle(element).backgroundImage
    )
  ).not.toBe('none')
  await expect(page.locator('.preview-dock')).toBeVisible()
  await page.waitForTimeout(300)
  await expect(historyDialog.getByText('浅色液态玻璃二维码生成测试')).toBeVisible()
  await page.screenshot({ path: 'test-results/qrtool-light-history.png' })
  await expectModalCloseHitbox(historyDialog)

  const generateItem = historyDialog
    .locator('.history-dialog-item')
    .filter({ hasText: '浅色液态玻璃二维码生成测试' })
  await generateItem.getByRole('button', { name: '回填内容' }).click()
  await expect(historyDialog).not.toBeVisible()
  await expect(textArea).toHaveValue('浅色液态玻璃二维码生成测试')

  await page.locator('.history-toggle').click()
  const reopenedHistory = page.getByRole('dialog', { name: '历史记录' })
  await reopenedHistory.getByRole('button', { name: '清空记录' }).click()
  const confirmDialog = page.getByRole('dialog', { name: '清空历史记录' })
  await confirmDialog.getByRole('button', { name: '清空' }).click()
  await expect(confirmDialog).not.toBeVisible()
  await page.locator('.history-toggle').click()
  const emptyHistory = page.getByRole('dialog', { name: '历史记录' })
  await expect(emptyHistory.getByText('还没有历史记录')).toBeVisible()
  await emptyHistory.locator('.history-dialog-footer').getByRole('button', { name: '关闭' }).click()
})

test('opens Chinese settings and announcement overlays', async () => {
  await page.getByRole('button', { name: '开发公告' }).click()
  await expect(page.getByRole('dialog', { name: '开发公告' })).toBeVisible()
  await page.waitForTimeout(300)
  await expect(page.getByText('v7.2.0', { exact: false }).first()).toBeVisible()
  const announcementDialog = page.getByRole('dialog', { name: '开发公告' })
  const announcementClose = await expectModalCloseHitbox(announcementDialog)
  await expect(
    announcementDialog.getByRole('button', { name: '项目官网（即将上线）' })
  ).toBeDisabled()
  await expect(
    announcementDialog.getByRole('button', { name: 'Plasma UI 项目' })
  ).toBeEnabled()
  await expect(
    announcementDialog.getByRole('button', { name: 'GitHub 仓库' })
  ).toBeEnabled()
  await expect(
    announcementDialog.getByRole('button', { name: '最新发布' })
  ).toBeEnabled()
  const insecureLinkError = await page.evaluate(async () => {
    try {
      await window.qrTool.openExternal('http://example.com')
      return ''
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  })
  expect(insecureLinkError).toContain('仅支持安全的 HTTPS 链接')
  await page.screenshot({ path: 'test-results/qrtool-light-announcement.png' })
  await announcementClose.click()

  const bannedEnglish = [
    'REBUILD WORKSPACE',
    'TEXT ENCODER',
    'LIVE PREVIEW',
    'ACTIVITY ARCHIVE',
    'PLASMA MATERIAL',
    'RELEASE NOTES',
    'NOTICE',
    'API Key',
    'API 状态',
    'Tidal',
    'Aurora',
    'Ember',
    'Plasma Liquid Workspace'
  ]
  const visibleText = await page.locator('.app-shell').innerText()
  for (const phrase of bannedEnglish) {
    expect(visibleText).not.toContain(phrase)
  }
})

test('keeps a usable frame budget in light mode', async () => {
  const samples = await page.evaluate(async () => {
    const frameTimes: number[] = []
    let previous = performance.now()
    await new Promise<void>((resolve) => {
      let frames = 0
      const tick = (now: number): void => {
        frameTimes.push(now - previous)
        previous = now
        frames += 1
        if (frames >= 90) resolve()
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    return frameTimes.slice(5)
  })
  samples.sort((left, right) => left - right)
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length
  const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))] ?? 0
  expect(average).toBeLessThan(25)
  expect(p95).toBeLessThan(34)
})

test('keeps clear spacing at large and minimum window sizes', async () => {
  await page.getByRole('tab', { name: '图片重构' }).click()
  await electronApp.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(1720, 1000)
  })
  await page.waitForTimeout(450)
  const gaps = await page.evaluate(() => {
    const title = document.querySelector('.titlebar')?.getBoundingClientRect()
    const layout = document.querySelector('.workspace-layout')?.getBoundingClientRect()
    const nav = document.querySelector('.workspace-nav')?.getBoundingClientRect()
    const task = document.querySelector('.task-area')?.getBoundingClientRect()
    const preview = document.querySelector('.preview-area')?.getBoundingClientRect()
    return {
      header: title && layout ? layout.top - title.bottom : 0,
      navTask: nav && task ? task.left - nav.right : 0,
      taskPreview: task && preview ? preview.left - task.right : 0
    }
  })
  expect(gaps.header).toBeGreaterThanOrEqual(15)
  expect(gaps.navTask).toBeGreaterThanOrEqual(18)
  expect(gaps.taskPreview).toBeGreaterThanOrEqual(18)
  await page.screenshot({ path: 'test-results/qrtool-light-large.png' })

  await electronApp.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(980, 700)
  })
  await page.waitForTimeout(450)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true)
  await expect(page.getByRole('button', { name: '选择二维码图片' })).toBeVisible()
  await page.screenshot({ path: 'test-results/qrtool-light-minimum.png' })

  await page.getByRole('button', { name: '软件设置' }).click()
  const settingsDialog = page.getByRole('dialog', { name: '软件设置' })
  await settingsDialog.locator('.settings-nav').getByRole('tab', { name: /玻璃材质/ }).click()
  await page.waitForTimeout(350)
  expect(
    await page.locator('.settings-pane').evaluate(
      (element) => element.scrollWidth <= element.clientWidth
    )
  ).toBe(true)
  await expect(settingsDialog.getByRole('button', { name: '完成' })).toBeVisible()
  const modalPanelBox = await settingsDialog.boundingBox()
  expect(modalPanelBox).not.toBeNull()
  if (modalPanelBox) {
    expect(modalPanelBox.y).toBeGreaterThanOrEqual(40)
    expect(700 - (modalPanelBox.y + modalPanelBox.height)).toBeGreaterThanOrEqual(40)
  }
  await page.screenshot({ path: 'test-results/qrtool-light-settings-minimum.png' })
  await settingsDialog.getByRole('button', { name: '完成' }).click()
  expect(rendererErrors).toEqual([])
})

test('generates Unicode and long content locally while every main-process fetch fails', async () => {
  await electronApp.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(1320, 900)
  })
  await page.getByRole('tab', { name: '文本生成' }).click()
  await configureQr({ engine: 'local', size: 1024, errorCorrection: 'M', border: 2 })
  const previousRequests = qrRequests.length
  const unicode = '  \n中文第一行：本地生成 🐉\nhttps://example.com/二维码?name=易码\n  保留首尾空白  \n '
  await setMainNetworkBlocked(true)
  try {
    const png = await generateAndSave(unicode, 'unicode-offline.png')
    expect([png.width, png.height]).toEqual([1024, 1024])
    await configureQr({ engine: 'local', size: 1024, errorCorrection: 'M', border: 8 })
    await generateAndSave('abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(17).slice(0, 1000), 'long-ascii-offline.png')
    await configureQr({ engine: 'local', size: 1024, errorCorrection: 'L', border: 8 })
    const chinese = '本地二维码生成支持中文长文本和多行内容。'.repeat(50).slice(0, 950)
    await generateAndSave(chinese, 'long-chinese-offline.png')

    const history = await page.evaluate(() => window.qrTool.getHistory())
    const record = history.find((item) => item.content === unicode)
    expect(record?.savedPath).toBe(path.join(outputRoot, 'unicode-offline.png'))
    expect(history.some((item) => item.content === chinese)).toBe(true)
    expect(await mainNetworkAttempts()).toEqual([])
    expect(qrRequests.slice(previousRequests)).toEqual([])
  } finally {
    await setMainNetworkBlocked(false)
  }
})

test('persists QR parameters and applies all correction levels and border limits', async () => {
  const settings: QrSettings = { engine: 'local', size: 512, errorCorrection: 'Q', border: 16 }
  await configureQr(settings)
  const persisted = JSON.parse(await readFile(path.join(dataRoot, 'config', 'config.json'), 'utf8')) as {
    qr: QrSettings
  }
  expect(persisted.qr).toEqual(settings)
  await page.reload()
  await page.waitForSelector('.app-shell')
  const dialog = await openQrSettings()
  await expect(dialog.getByRole('slider', { name: '二维码尺寸', exact: true })).toHaveValue('512')
  await expect(dialog.getByRole('slider', { name: '边框', exact: true })).toHaveValue('16')
  await expect(dialog.getByRole('group', { name: '纠错级别', exact: true }).getByRole('button', {
    name: 'Q', exact: true
  })).toHaveAttribute('aria-pressed', 'true')
  await electronApp.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(1120, 780)
  })
  await dialog.locator('.settings-pane').evaluate((element) => element.scrollTo(0, 0))
  await expect(dialog.locator('.settings-nav').getByRole('tab', { name: /接口与保存/ })).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.getByRole('group', { name: '处理引擎', exact: true })).toBeVisible()
  await page.waitForTimeout(650)
  await page.screenshot({ path: 'test-results/qrtool-local-settings.png' })
  await electronApp.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(1320, 900)
  })
  await dialog.getByRole('button', { name: '完成', exact: true }).click()
  await page.getByRole('tab', { name: '文本生成' }).click()
  const withBorder = await generateAndSave('边框与尺寸参数持久化', 'parameters-persisted.png')
  expect([withBorder.width, withBorder.height]).toEqual([512, 512])
  // A generous quiet zone must remain visibly white after PNG encoding.
  expect([...withBorder.data.subarray(0, withBorder.width * 4 * 32)].every((value) => value === 255)).toBe(true)

  for (const errorCorrection of ['L', 'M', 'Q', 'H'] as const) {
    await configureQr({ engine: 'local', size: 512, errorCorrection, border: 0 })
    const png = await generateAndSave(`纠错级别 ${errorCorrection}`, `correction-${errorCorrection}.png`)
    expect([png.width, png.height]).toEqual([512, 512])
    expect(png.data[0]).toBe(0)
  }
})

test('imports more than 2000 characters and recovers from an over-capacity generation', async () => {
  await page.getByRole('tab', { name: '文本生成' }).click()
  await configureQr({ engine: 'local', size: 1024, errorCorrection: 'L', border: 8 })
  const digits = '1234567890'.repeat(300)
  const importedFile = path.join(dataRoot, 'long-digits.txt')
  await writeFile(importedFile, digits, 'utf8')
  await overrideOpenDialog(importedFile)
  await page.getByRole('button', { name: '从文本文件读取' }).click()
  await expect(page.locator('textarea.content-input')).toHaveValue(digits)
  await generateAndSave(digits, 'imported-3000-digits.png')

  await page.locator('textarea.content-input').fill('容量'.repeat(2500))
  await page.getByRole('button', { name: '生成二维码', exact: true }).click()
  await expect(page.locator('.status-text.error')).toContainText(/容量|过长|超出/)
  await expect(page.getByRole('button', { name: '生成二维码', exact: true })).toBeEnabled()
  await generateAndSave('失败后仍可重新生成', 'recovered-after-capacity-error.png')
})

test('uses the online adapter only after an explicit switch and keeps immediate local requests private', async () => {
  await configureQr({ engine: 'caoliao', size: 768, errorCorrection: 'H', border: 4 })
  const previousRequests = qrRequests.length
  const onlineContent = '明确选择草料在线生成'
  const onlinePng = await generateAndSave(onlineContent, 'explicit-online.png')
  expect([onlinePng.width, onlinePng.height]).toEqual([768, 768])
  const onlineRequests = qrRequests.slice(previousRequests)
  expect(onlineRequests).toHaveLength(1)
  const onlineUrl = new URL(onlineRequests[0] ?? '', 'http://127.0.0.1')
  expect(onlineUrl.pathname).toBe('/v1/create-qr-code')
  expect(onlineUrl.searchParams.get('data')).toBe(onlineContent)
  expect(onlineUrl.searchParams.get('size')).toBe('768x768')
  expect(onlineUrl.searchParams.get('error_correction')).toBe('H')
  expect(onlineUrl.searchParams.get('border')).toBe('4')

  const localContent = '切换本地立即生成，不上传这段内容'
  await page.locator('textarea.content-input').fill(localContent)
  const previousSource = await page.getByAltText('生成的二维码').getAttribute('src')
  await openQrSettings()
  await setMainNetworkBlocked(true)
  try {
    // Stay inside the 200 ms settings debounce window: persisted engine is still online.
    const storedEngine = await page.evaluate(async () => {
      const dialog = document.querySelector('[role="dialog"]')
      const localButton = Array.from(dialog?.querySelectorAll('button') ?? []).find(
        (button) => button.textContent?.trim() === '本地处理（离线）'
      )
      localButton?.click()
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const stored = (await window.qrTool.bootstrap()).settings.qr.engine
      const doneButton = Array.from(dialog?.querySelectorAll('button') ?? []).find(
        (button) => button.textContent?.trim() === '完成'
      )
      doneButton?.click()
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const generateButton = Array.from(document.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === '生成二维码'
      )
      if (!localButton || !doneButton || !generateButton) throw new Error('切换与生成按钮不可用')
      generateButton.click()
      return stored
    })
    expect(storedEngine).toBe('caoliao')
    await expect(page.getByAltText('生成的二维码')).not.toHaveAttribute('src', previousSource ?? '')
    const savedFile = path.join(outputRoot, 'immediate-local.png')
    await overrideSaveDialog(savedFile)
    await page.getByRole('button', { name: '下载二维码' }).click()
    await decodeSavedPng(savedFile, localContent)
    expect(await mainNetworkAttempts()).toEqual([])
    expect(qrRequests.slice(previousRequests)).toEqual(onlineRequests)
    await expect.poll(() => page.evaluate(async () => (await window.qrTool.bootstrap()).settings.qr.engine)).toBe('local')
  } finally {
    await setMainNetworkBlocked(false)
  }
  expect(rendererErrors).toEqual([])
})

test('keeps a new local selection when an older online settings write and event arrive late', async () => {
  await configureQr({ engine: 'local', size: 1024, errorCorrection: 'M', border: 2 })
  await electronApp.evaluate(({ ipcMain }) => {
    type SettingsHandler = (event: Electron.IpcMainInvokeEvent, patch: unknown) => unknown
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, SettingsHandler> })._invokeHandlers
    const original = handlers.get('settings:update')
    if (!original) throw new Error('设置 IPC 处理器未注册')
    const state = globalThis as typeof globalThis & {
      qrE2eOriginalSettingsHandler?: SettingsHandler
      qrE2eSettingsWriteStarted?: boolean
      qrE2eSettingsWriteFinished?: boolean
    }
    state.qrE2eOriginalSettingsHandler = original
    state.qrE2eSettingsWriteStarted = false
    state.qrE2eSettingsWriteFinished = false
    ipcMain.removeHandler('settings:update')
    ipcMain.handle('settings:update', async (event, patch: { qr?: { engine?: string } }) => {
      if (patch.qr?.engine === 'caoliao' && !state.qrE2eSettingsWriteStarted) {
        state.qrE2eSettingsWriteStarted = true
        await new Promise<void>((resolve) => setTimeout(resolve, 500))
        const result = await original(event, patch)
        state.qrE2eSettingsWriteFinished = true
        return result
      }
      return original(event, patch)
    })
  })
  await setMainNetworkBlocked(true)
  try {
    const dialog = await openQrSettings()
    const engines = dialog.getByRole('group', { name: '处理引擎', exact: true })
    await engines.getByRole('button', { name: '草料在线', exact: true }).click()
    await expect.poll(() => electronApp.evaluate(() =>
      (globalThis as typeof globalThis & { qrE2eSettingsWriteStarted?: boolean }).qrE2eSettingsWriteStarted
    )).toBe(true)
    const localButton = engines.getByRole('button', { name: '本地处理（离线）', exact: true })
    await localButton.click()
    await expect(localButton).toHaveAttribute('aria-pressed', 'true')
    await page.evaluate(() => {
      const state = window as typeof window & { qrE2eSelectionLost?: boolean; qrE2eObserver?: MutationObserver }
      const group = document.querySelector('[role="group"][aria-label="处理引擎"]')
      const button = Array.from(group?.querySelectorAll('button') ?? []).find(
        (item) => item.textContent?.trim() === '本地处理（离线）'
      )
      if (!button) throw new Error('本地引擎选项不可用')
      state.qrE2eSelectionLost = false
      state.qrE2eObserver = new MutationObserver(() => {
        if (button.getAttribute('aria-pressed') !== 'true') state.qrE2eSelectionLost = true
      })
      state.qrE2eObserver.observe(button, { attributes: true, attributeFilter: ['aria-pressed'] })
    })
    await expect.poll(() => electronApp.evaluate(() =>
      (globalThis as typeof globalThis & { qrE2eSettingsWriteFinished?: boolean }).qrE2eSettingsWriteFinished
    )).toBe(true)
    await expect.poll(() => page.evaluate(async () => (await window.qrTool.bootstrap()).settings.qr.engine)).toBe('local')
    await expect(localButton).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(() =>
      (window as typeof window & { qrE2eSelectionLost?: boolean }).qrE2eSelectionLost
    )).toBe(false)
    await dialog.getByRole('button', { name: '完成', exact: true }).click()
    await generateAndSave('旧设置响应不能覆盖新的本地选择', 'local-after-delayed-settings.png')
    const persisted = JSON.parse(await readFile(path.join(dataRoot, 'config', 'config.json'), 'utf8')) as {
      qr: QrSettings
    }
    expect(persisted.qr.engine).toBe('local')
    expect((await mainNetworkAttempts()).filter((url) => /create-qr-code|read-qr-code/.test(url))).toEqual([])
  } finally {
    await setMainNetworkBlocked(false)
    await electronApp.evaluate(({ ipcMain }) => {
      type SettingsHandler = (event: Electron.IpcMainInvokeEvent, patch: unknown) => unknown
      const state = globalThis as typeof globalThis & { qrE2eOriginalSettingsHandler?: SettingsHandler }
      if (state.qrE2eOriginalSettingsHandler) {
        ipcMain.removeHandler('settings:update')
        ipcMain.handle('settings:update', state.qrE2eOriginalSettingsHandler)
        delete state.qrE2eOriginalSettingsHandler
      }
    })
    await page.evaluate(() => {
      const state = window as typeof window & { qrE2eObserver?: MutationObserver }
      state.qrE2eObserver?.disconnect()
      delete state.qrE2eObserver
    })
  }
})


async function chooseAndRebuild(source: string, expectedContent: string): Promise<string> {
  await page.getByRole('tab', { name: '图片重构' }).click()
  const previousId = (await page.evaluate(() => window.qrTool.getHistory()))[0]?.id
  await overrideOpenDialog(source)
  await page.getByRole('button', { name: '选择二维码图片', exact: true }).click()
  await expect.poll(async () => (await page.evaluate(() => window.qrTool.getHistory()))[0]?.id).not.toBe(previousId)
  await expect(page.locator('.status-pill.success')).toContainText('重构完成')
  expect(await page.locator('.decode-output').textContent()).toBe(expectedContent)
  const history = await page.evaluate(() => window.qrTool.getHistory())
  const record = history[0]
  expect(record?.type).toBe('rebuild')
  expect(record?.content).toBe(expectedContent)
  await decodeSavedPng(record!.savedPath, expectedContent)
  return record!.savedPath
}

test('normalizes all image formats and variants and rebuilds them with both processes offline', async () => {
  test.setTimeout(120_000)
  await configureQr({ engine: 'local', size: 1024, errorCorrection: 'M', border: 2 })
  await setMainNetworkBlocked(true)
  const rendererNetwork: string[] = []
  await page.context().route(/^https?:\/\//, (route) => {
    rendererNetwork.push(route.request().url())
    return route.abort()
  })
  const previousRequests = qrRequests.length
  try {
    for (const file of ['base.png', 'sample.jpg', 'sample.bmp', 'animated.gif', 'sample.webp',
      'low-resolution.png', 'rotate-90.png', 'rotate-180.png', 'rotate-270.png',
      'inverted.png', 'transparent.png', 'offset.png']) {
      const saved = await chooseAndRebuild(path.join(decodeFixtures, file), decodeContent)
      expect(path.basename(saved)).toBe(`${path.parse(file).name}_rebuild.png`)
    }
    const saved = await chooseAndRebuild(path.join(decodeFixtures, 'multiple.png'), decodeContent)
    await expect(page.locator('.status-pill.success')).toContainText('共检测到 4 个二维码')
    await chooseAndRebuild(saved, decodeContent)
    expect(qrRequests.slice(previousRequests)).toEqual([])
    expect((await mainNetworkAttempts()).filter((url) => !url.includes('github'))).toEqual([])
    expect(rendererNetwork).toEqual([])
    await page.waitForTimeout(650)
    await page.screenshot({ path: 'test-results/v7.2-offline-rebuild.png' })
  } finally {
    await page.context().unroute(/^https?:\/\//)
    await setMainNetworkBlocked(false)
  }
})

test('drops a real file and keeps the entire conversion-to-save operation busy', async () => {
  await page.getByRole('tab', { name: '图片重构' }).click()
  await setMainNetworkBlocked(true)
  await page.context().route(/^https?:\/\//, (route) => route.abort())
  const previousId = (await page.evaluate(() => window.qrTool.getHistory()))[0]?.id
  // Delay Chromium conversion so the UI guard and bitmap release can be observed.
  await page.evaluate(() => {
    const state = window as typeof window & { originalBitmap?: typeof createImageBitmap; bitmapClosed?: number }
    state.originalBitmap = window.createImageBitmap
    state.bitmapClosed = 0
    window.createImageBitmap = (async (blob: Blob) => {
      await new Promise((resolve) => setTimeout(resolve, 800))
      const bitmap = await state.originalBitmap!(blob)
      const close = bitmap.close.bind(bitmap)
      bitmap.close = () => { state.bitmapClosed = (state.bitmapClosed ?? 0) + 1; close() }
      return bitmap
    }) as typeof createImageBitmap
  })
  const session = await page.context().newCDPSession(page)
  try {
    const box = await page.locator('.image-drop-zone').boundingBox()
    if (!box) throw new Error('Drop zone unavailable')
    const drag = { x: box.x + 40, y: box.y + 40,
      data: { items: [], files: [path.join(decodeFixtures, 'sample.webp')], dragOperationsMask: 1 } }
    await session.send('Input.dispatchDragEvent', { type: 'dragEnter', ...drag })
    await session.send('Input.dispatchDragEvent', { type: 'dragOver', ...drag })
    await session.send('Input.dispatchDragEvent', { type: 'drop', ...drag })
    await expect(page.getByRole('button', { name: '正在处理…', exact: true })).toBeDisabled()
    await session.send('Input.dispatchDragEvent', { type: 'dragEnter', ...drag })
    await session.send('Input.dispatchDragEvent', { type: 'drop', ...drag })
    await expect.poll(async () => (await page.evaluate(() => window.qrTool.getHistory()))[0]?.id).not.toBe(previousId)
    await expect(page.locator('.status-pill.success')).toContainText('重构完成')
    expect(await page.evaluate(() => (window as typeof window & { bitmapClosed?: number }).bitmapClosed)).toBe(1)
    await decodeSavedPng(path.join(outputRoot, 'sample_rebuild.png'), decodeContent)
    expect((await mainNetworkAttempts()).filter((url) => /read-qr-code|create-qr-code/.test(url))).toEqual([])
  } finally {
    await session.detach()
    await page.evaluate(() => {
      const state = window as typeof window & { originalBitmap?: typeof createImageBitmap }
      if (state.originalBitmap) window.createImageBitmap = state.originalBitmap
    })
    await page.context().unroute(/^https?:\/\//)
    await setMainNetworkBlocked(false)
  }
})

test('rejects invalid and oversized images without history and retries the same image after recovery', async () => {
  await page.getByRole('tab', { name: '图片重构' }).click()
  await configureQr({ engine: 'local', size: 1024, errorCorrection: 'M', border: 2 })
  const before = await page.evaluate(() => window.qrTool.getHistory())
  for (const [file, message] of [
    ['no-qr.png', '未识别到二维码'], ['corrupt.png', '图片无法读取'],
    ['too-wide.png', '图片过大'], ['too-many-pixels.png', '图片过大'],
    ['capacity.png', '二维码容量']
  ]) {
    await overrideOpenDialog(path.join(decodeFixtures, file!))
    await page.getByRole('button', { name: '选择二维码图片', exact: true }).click()
    await expect(page.locator('.status-pill.error')).toContainText(message!)
    expect(await page.evaluate(() => window.qrTool.getHistory())).toEqual(before)
    await expect(page.getByRole('button', { name: '重试此图片' })).toBeEnabled()
  }
  // A repair to the same selected path can be retried without a new file dialog.
  const retryImage = path.join(dataRoot, 'repair.png')
  await writeFile(retryImage, await readFile(path.join(decodeFixtures, 'no-qr.png')))
  await overrideOpenDialog(retryImage)
  await page.getByRole('button', { name: '选择二维码图片', exact: true }).click()
  await expect(page.locator('.status-pill.error')).toContainText('未识别到二维码')
  await writeFile(retryImage, await readFile(path.join(decodeFixtures, 'base.png')))
  await page.getByRole('button', { name: '重试此图片' }).click()
  await expect(page.locator('.status-pill.success')).toContainText('重构完成')
  await decodeSavedPng(path.join(outputRoot, 'repair_rebuild.png'), decodeContent)

  const oversized = path.join(dataRoot, 'oversized.png')
  await writeFile(oversized, '')
  await truncate(oversized, 32 * 1024 * 1024 + 1)
  await overrideOpenDialog(oversized)
  await page.getByRole('button', { name: '选择二维码图片', exact: true }).click()
  await expect(page.locator('.status-pill.error')).toContainText('32 MiB')
  // QR limits must not restrict background selection.
  await overrideOpenDialog(path.join(decodeFixtures, 'too-wide.png'))
  await page.evaluate(() => window.qrTool.chooseBackgroundImage())
  await page.evaluate(() => window.qrTool.clearBackgroundImage())
  expect(rendererErrors).toEqual([])
})

test('does not record a save failure and can retry after changing the save location', async () => {
  const invalidDirectory = path.join(dataRoot, 'file-instead-of-directory')
  await writeFile(invalidDirectory, 'not a directory')
  await page.evaluate((directory) => window.qrTool.updateSettings({ output: { mode: 'custom', directory } }), invalidDirectory)
  const before = await page.evaluate(() => window.qrTool.getHistory())
  await overrideOpenDialog(path.join(decodeFixtures, 'base.png'))
  await page.getByRole('button', { name: '选择二维码图片', exact: true }).click()
  await expect(page.locator('.status-pill.error')).toContainText('保存失败')
  expect(await page.evaluate(() => window.qrTool.getHistory())).toEqual(before)
  await page.evaluate((directory) => window.qrTool.updateSettings({ output: { mode: 'custom', directory } }), outputRoot)
  await page.getByRole('button', { name: '重试此图片' }).click()
  await expect(page.locator('.status-pill.success')).toContainText('重构完成')
  await decodeSavedPng(path.join(outputRoot, 'base_rebuild.png'), decodeContent)
})

test('only uploads an image for explicit online rebuild and snapshots an immediate local switch', async () => {
  await configureQr({ engine: 'caoliao', size: 1024, errorCorrection: 'M', border: 2 })
  const previousRequests = qrRequests.length
  await chooseAndRebuild(path.join(decodeFixtures, 'sample.jpg'), 'https://example.com/plasma-e2e')
  expect(qrRequests.slice(previousRequests).map((item) => item.split('?')[0])).toEqual([
    '/v1/read-qr-code', '/v1/create-qr-code'
  ])
  const dialog = await openQrSettings()
  await overrideOpenDialog(path.join(decodeFixtures, 'base.png'))
  await setMainNetworkBlocked(true)
  await page.context().route(/^https?:\/\//, (route) => route.abort())
  try {
    const previousId = (await page.evaluate(() => window.qrTool.getHistory()))[0]?.id
    const stored = await dialog.evaluate(async (element) => {
      const buttons = Array.from(element.querySelectorAll('button'))
      buttons.find((button) => button.textContent?.trim() === '本地处理（离线）')?.click()
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const engine = (await window.qrTool.bootstrap()).settings.qr.engine
      buttons.find((button) => button.textContent?.trim() === '完成')?.click()
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.trim() === '选择二维码图片')?.click()
      return engine
    })
    expect(stored).toBe('caoliao')
    await expect.poll(async () => (await page.evaluate(() => window.qrTool.getHistory()))[0]?.id).not.toBe(previousId)
    await expect(page.locator('.status-pill.success')).toContainText('重构完成')
    expect(await page.locator('.decode-output').textContent()).toBe(decodeContent)
    expect((await mainNetworkAttempts()).filter((url) => /read-qr-code|create-qr-code/.test(url))).toEqual([])
    expect(qrRequests).toHaveLength(previousRequests + 2)
  } finally {
    await setMainNetworkBlocked(false)
    await page.context().unroute(/^https?:\/\//)
  }
})
