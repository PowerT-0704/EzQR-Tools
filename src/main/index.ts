import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { access, readFile } from 'node:fs/promises'
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  protocol,
  shell
} from 'electron'
import {
  APP_AUTHOR_EMAIL,
  APP_NAME,
  APP_USER_MODEL_ID,
  IMAGE_EXTENSIONS,
  MAX_QR_SOURCE_BYTES,
  MEDIA_SCHEME,
  UI_TEXT_LIMIT
} from '../shared/constants'
import { IPC } from '../shared/channels'
import type {
  ApiConfig,
  ApiStatus,
  AppSettingsView,
  BootstrapData,
  DataRootChange,
  GenerateRequest,
  GenerateResult,
  HistoryRecord,
  MediaSelection,
  OperationProgress,
  QrSettings,
  RebuildRequest,
  RebuildResult,
  SaveQrResult,
  SettingsPatch,
  TextImportResult,
  UpdateInfo,
  WindowState
} from '../shared/types'
import { AnnouncementStore } from './services/announcement-store'
import { CaoliaoQrEngine } from './services/caoliao-qr-engine'
import { ConfigStore } from './services/config-store'
import { AppError, messageFromError } from './services/errors'
import { validateExternalUrl } from './services/external-links'
import { HistoryStore } from './services/history-store'
import { MediaStore } from './services/media-store'
import { LocalQrEngine } from './services/local-qr-engine'
import { validateQrSource } from './services/image-input'
import type { QrCodeEngine } from './services/qr-code-engine'
import { validateQrSettings } from './services/qr-code-engine'
import {
  buildRebuildPath,
  customOutputDirectory,
  defaultDownloadDirectory,
  savePng
} from './services/qr-output'
import { extractText } from './services/text-import'
import { checkForLatestRelease } from './services/update-service'

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const isDevelopment = Boolean(process.env.ELECTRON_RENDERER_URL)

if (process.env.QRTOOL_USER_DATA_DIR) {
  app.setPath('userData', resolve(process.env.QRTOOL_USER_DATA_DIR))
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

let mainWindow: BrowserWindow | null = null
let configStore: ConfigStore
let historyStore: HistoryStore
let announcementStore: AnnouncementStore
const mediaStore = new MediaStore()
let busyRebuild = false
let busyGenerate = false
let busyApiCheck = false
let lastGeneratedBytes: Buffer | null = null
let lastGeneratedRecordId: string | null = null
let lastGeneratedSavedPath: string | null = null
let lastRebuiltPath: string | null = null
let apiStatus: ApiStatus = { ok: null, message: '草料解析：未检测', checkedAt: null }

function resourcesDirectory(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(app.getAppPath(), 'resources')
}

async function exists(filePath: string): Promise<boolean> {
  return access(filePath)
    .then(() => true)
    .catch(() => false)
}

function processingEngine(qr: QrSettings, api: ApiConfig): QrCodeEngine {
  return qr.engine === 'local' ? new LocalQrEngine() : new CaoliaoQrEngine(api)
}

function rendererWindow(): BrowserWindow {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('主窗口尚未就绪')
  }
  return mainWindow
}

function send(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function sendProgress(operationId: string, kind: OperationProgress['kind'], message: string): void {
  const event: OperationProgress = { operationId, kind, message }
  send(IPC.progress, event)
}

function notifyHistory(): void {
  send(IPC.historyChanged, historyStore.get())
}

function backgroundImageUrl(): string {
  const imagePath = configStore.get().appearance.backgroundImage
  return imagePath ? mediaStore.addFile(imagePath) : ''
}

function settingsView(): AppSettingsView {
  return configStore.settingsView(backgroundImageUrl())
}

function notifySettings(): void {
  send(IPC.settingsChanged, settingsView())
}

function windowState(): WindowState {
  return { maximized: Boolean(mainWindow?.isMaximized()) }
}

async function prepareImage(filePath: string, qrSource = true): Promise<MediaSelection> {
  const resolved = resolve(filePath)
  if (!IMAGE_EXTENSIONS.includes(extname(resolved).toLowerCase() as (typeof IMAGE_EXTENSIONS)[number])) {
    throw new AppError('IMAGE_TYPE', '不支持的图片格式，请选择 PNG / JPG / BMP / GIF / WebP')
  }
  if (!(await exists(resolved))) {
    throw new AppError('IMAGE_MISSING', '文件不存在或已被移动')
  }
  if (qrSource) await validateQrSource(resolved)
  return {
    path: resolved,
    previewUrl: mediaStore.addFile(resolved),
    name: resolved.split(/[\\/]/).pop() || resolved
  }
}

async function rebuild(request: RebuildRequest): Promise<RebuildResult> {
  if (busyRebuild) throw new AppError('BUSY', '已有二维码重构任务正在进行')
  if (
    !request ||
    typeof request.operationId !== 'string' ||
    !request.operationId.trim() ||
    typeof request.path !== 'string' ||
    !request.path
  ) {
    throw new AppError('INVALID_REQUEST', '请求参数不完整')
  }
  busyRebuild = true
  try {
    sendProgress(request.operationId, 'rebuild', '准备解析图片…')
    const config = configStore.get()
    const qr = validateQrSettings(request.qr === undefined ? config.qr : request.qr)
    const engine = processingEngine(qr, config.api)
    const source = await prepareImage(request.path)
    sendProgress(request.operationId, 'rebuild', qr.engine === 'local' ? '正在本地解析二维码…' : '正在上传并解析二维码…')
    let sourceBytes: Uint8Array
    if (qr.engine === 'local') {
      if (!request.normalizedPng) throw new AppError('INVALID_IMAGE', '缺少本地解析所需的 PNG 数据，请重新选择图片')
      sourceBytes = request.normalizedPng
    } else {
      try {
        sourceBytes = await readFile(source.path)
      } catch (error) {
        throw new AppError('IMAGE_READ', `无法读取图片文件：${messageFromError(error)}`)
      }
      if (sourceBytes.byteLength > MAX_QR_SOURCE_BYTES) {
        throw new AppError('IMAGE_TOO_LARGE', '二维码源图片最多 32 MiB，请裁剪或缩小后重试')
      }
    }
    const contents = await engine.decode({ bytes: sourceBytes, name: source.name })
    if (!contents.length) {
      throw new AppError('QR_NOT_FOUND', '未识别到二维码，请确认图片中包含完整清晰的二维码')
    }
    const content = contents[0] ?? ''
    if (content.length > UI_TEXT_LIMIT) {
      throw new AppError('CONTENT_TOO_LONG', `内容超过 ${UI_TEXT_LIMIT} 字符上限，请缩短后重试`)
    }
    sendProgress(
      request.operationId,
      'rebuild',
      qr.engine === 'local' ? '解析成功，正在本地生成高清二维码…' : '解析成功，正在通过草料生成高清二维码…'
    )
    const bytes = await engine.encode(content, qr)
    let target: string
    try {
      target = await buildRebuildPath(source.path, config)
      await savePng(target, bytes)
    } catch (error) {
      throw new AppError('SAVE_FAILED', `二维码已解析，但保存失败，请检查保存位置后重试：${messageFromError(error)}`)
    }
    lastRebuiltPath = target
    await historyStore.add('rebuild', content, target)
    notifyHistory()
    sendProgress(request.operationId, 'rebuild', '重构完成')
    return {
      contents,
      content,
      sourcePath: source.path,
      savedPath: target,
      sourcePreviewUrl: source.previewUrl,
      rebuiltPreviewUrl: mediaStore.addBuffer(bytes)
    }
  } finally {
    busyRebuild = false
  }
}

async function generate(request: GenerateRequest): Promise<GenerateResult> {
  if (busyGenerate) throw new AppError('BUSY', '已有二维码生成任务正在进行')
  if (
    !request ||
    typeof request.operationId !== 'string' ||
    !request.operationId.trim() ||
    typeof request.content !== 'string'
  ) {
    throw new AppError('INVALID_REQUEST', '请求参数不完整')
  }
  const content = request.content
  if (!content.trim()) throw new AppError('EMPTY_CONTENT', '请先输入要生成二维码的内容')
  if (content.length > UI_TEXT_LIMIT) {
    throw new AppError('CONTENT_TOO_LONG', `内容超过 ${UI_TEXT_LIMIT} 字符上限，请缩短后重试`)
  }
  busyGenerate = true
  try {
    const config = configStore.get()
    const qr = validateQrSettings(request.qr === undefined ? config.qr : request.qr)
    const engine = processingEngine(qr, config.api)
    sendProgress(
      request.operationId,
      'generate',
      qr.engine === 'local' ? '正在本地生成二维码…' : '正在通过草料生成二维码…'
    )
    const bytes = await engine.encode(content, qr)
    const record = await historyStore.add('generate', content)
    lastGeneratedBytes = bytes
    lastGeneratedSavedPath = null
    lastGeneratedRecordId = record.id
    notifyHistory()
    sendProgress(request.operationId, 'generate', '生成完成')
    return {
      info: `${qr.engine === 'local' ? '本地生成' : '草料在线生成'} · 内容长度 ${content.length} 字符 · 图片大小 ${(bytes.byteLength / 1024).toFixed(1)} KB`,
      previewUrl: mediaStore.addBuffer(bytes),
      recordId: record.id
    }
  } finally {
    busyGenerate = false
  }
}

async function saveQr(operationId: string): Promise<SaveQrResult | null> {
  if (!lastGeneratedBytes) throw new AppError('NO_QR', '请先生成二维码')
  const config = configStore.get()
  const defaultDirectory = await defaultDownloadDirectory(config, lastGeneratedSavedPath)
  const result = await dialog.showSaveDialog(rendererWindow(), {
    title: '保存二维码',
    defaultPath: join(defaultDirectory, 'QRCode.png'),
    filters: [{ name: 'PNG 图片', extensions: ['png'] }]
  })
  if (result.canceled || !result.filePath) return null
  sendProgress(operationId, 'save', '正在保存二维码…')
  const savedPath = await savePng(result.filePath, lastGeneratedBytes)
  lastGeneratedSavedPath = savedPath
  if (lastGeneratedRecordId) {
    await historyStore.updateSavedPath(lastGeneratedRecordId, savedPath)
    notifyHistory()
  }
  return { savedPath }
}

async function importTextWithLimits(): Promise<TextImportResult | null> {
  const result = await dialog.showOpenDialog(rendererWindow(), {
    title: '选择文本文件',
    properties: ['openFile'],
    filters: [
      {
        name: '文本文件',
        extensions: [
          'txt',
          'md',
          'markdown',
          'log',
          'csv',
          'tsv',
          'json',
          'xml',
          'html',
          'htm',
          'ini',
          'yml',
          'yaml',
          'docx',
          'docm',
          'doc',
          'odt',
          'rtf'
        ]
      },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  if (result.canceled || !result.filePaths[0]) return null
  const extracted = await extractText(result.filePaths[0])
  if (!extracted.ok) {
    return {
      ok: false,
      tooLong: false,
      chars: 0,
      name: extracted.name,
      text: '',
      message: extracted.message
    }
  }
  const chars = extracted.text.length
  if (chars > UI_TEXT_LIMIT) {
    return {
      ok: false,
      tooLong: false,
      chars,
      name: extracted.name,
      text: '',
      message: `内容过长（${chars} 字符，超过界面 ${UI_TEXT_LIMIT} 字符上限），请精简后重试`
    }
  }
  return {
    ok: true,
    tooLong: false,
    chars,
    name: extracted.name,
    text: extracted.text,
    message: ''
  }
}

async function updateSettings(patch: SettingsPatch): Promise<AppSettingsView> {
  if (!patch || typeof patch !== 'object') throw new AppError('INVALID_SETTINGS', '设置内容无效')
  await configStore.update((config) => {
    if (patch.api) {
      if (typeof patch.api.apiKey === 'string') config.api.apiKey = patch.api.apiKey.trim()
      if (typeof patch.api.baseUrl === 'string' && patch.api.baseUrl.trim()) {
        config.api.baseUrl = patch.api.baseUrl.trim()
      }
      if (patch.api.timeoutSeconds !== undefined) {
        config.api.timeoutSeconds = Number(patch.api.timeoutSeconds)
      }
    }
    if (patch.qr) {
      if (patch.qr.engine !== undefined) config.qr.engine = patch.qr.engine
      if (patch.qr.size !== undefined) config.qr.size = Number(patch.qr.size)
      if (patch.qr.errorCorrection !== undefined) {
        config.qr.errorCorrection = patch.qr.errorCorrection
      }
      if (patch.qr.border !== undefined) config.qr.border = Number(patch.qr.border)
    }
    if (patch.historyLimit !== undefined) {
      config.historyLimit = Number(patch.historyLimit)
    }
    if (patch.appearance) {
      if (patch.appearance.palette !== undefined) {
        config.appearance.palette = patch.appearance.palette
      }
      if (patch.appearance.backgroundImage !== undefined) {
        config.appearance.backgroundImage = patch.appearance.backgroundImage
      }
      if (patch.appearance.material) {
        Object.assign(config.appearance.material, patch.appearance.material)
      }
    }
    if (patch.output) {
      if (patch.output.mode !== undefined) config.output.mode = patch.output.mode
      if (patch.output.directory !== undefined) config.output.directory = patch.output.directory
    }
  })
  const updated = configStore.get()
  historyStore.setLimit(updated.historyLimit)
  await historyStore.save()
  notifyHistory()
  const view = settingsView()
  notifySettings()
  return view
}

function registerIpc(): void {
  ipcMain.handle(IPC.bootstrap, async (): Promise<BootstrapData> => ({
    appVersion: app.getVersion(),
    authorEmail: APP_AUTHOR_EMAIL,
    announcementEditable: !app.isPackaged,
    settings: settingsView(),
    history: historyStore.get(),
    announcementMarkdown: await announcementStore.read(),
    warnings: [...configStore.warnings]
  }))

  ipcMain.handle(IPC.chooseImage, async (): Promise<MediaSelection | null> => {
    const result = await dialog.showOpenDialog(rendererWindow(), {
      title: '选择二维码图片',
      properties: ['openFile'],
      filters: [
        { name: '图片文件', extensions: IMAGE_EXTENSIONS.map((item) => item.slice(1)) },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePaths[0]) return null
    return prepareImage(result.filePaths[0])
  })

  ipcMain.handle(IPC.prepareDroppedImage, (_event, filePath: unknown) =>
    prepareImage(String(filePath ?? ''))
  )
  ipcMain.handle(IPC.rebuild, (_event, request: RebuildRequest) => rebuild(request))
  ipcMain.handle(IPC.generate, (_event, request: GenerateRequest) => generate(request))
  ipcMain.handle(IPC.saveQr, (_event, operationId: unknown) => saveQr(String(operationId ?? '')))
  ipcMain.handle(IPC.chooseTextFile, () => importTextWithLimits())
  ipcMain.handle(IPC.getHistory, () => historyStore.get())
  ipcMain.handle(IPC.clearHistory, async (): Promise<HistoryRecord[]> => {
    await historyStore.clear()
    const records = historyStore.get()
    notifyHistory()
    return records
  })

  ipcMain.handle(IPC.checkApi, async (): Promise<ApiStatus> => {
    if (busyApiCheck) return apiStatus
    busyApiCheck = true
    try {
      const engine: QrCodeEngine = new CaoliaoQrEngine(configStore.get().api)
      apiStatus = await engine.health()
      return apiStatus
    } finally {
      busyApiCheck = false
    }
  })

  ipcMain.handle(IPC.checkForUpdates, (): Promise<UpdateInfo> => {
    const testApiUrl =
      !app.isPackaged && process.env.QRTOOL_UPDATE_API_URL
        ? process.env.QRTOOL_UPDATE_API_URL.trim()
        : ''
    return checkForLatestRelease({
      currentVersion: app.getVersion(),
      apiUrl: testApiUrl || undefined
    })
  })

  ipcMain.handle(IPC.updateSettings, (_event, patch: SettingsPatch) => updateSettings(patch))

  ipcMain.handle(IPC.chooseBackgroundImage, async (): Promise<AppSettingsView | null> => {
    const result = await dialog.showOpenDialog(rendererWindow(), {
      title: '选择背景图片',
      properties: ['openFile'],
      filters: [
        { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePaths[0]) return null
    const selected = await prepareImage(result.filePaths[0], false)
    return updateSettings({ appearance: { backgroundImage: selected.path } })
  })

  ipcMain.handle(IPC.clearBackgroundImage, () =>
    updateSettings({ appearance: { backgroundImage: '' } })
  )

  ipcMain.handle(IPC.chooseOutputDirectory, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog(rendererWindow(), {
      title: '选择二维码导出目录',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle(IPC.chooseDataDirectory, async (): Promise<DataRootChange | null> => {
    const result = await dialog.showOpenDialog(rendererWindow(), {
      title: '选择数据文件目录',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    const message = await configStore.setDataRoot(result.filePaths[0])
    return { changed: true, message }
  })

  ipcMain.handle(IPC.resetDataDirectory, async (): Promise<DataRootChange> => ({
    changed: true,
    message: await configStore.resetDataRoot()
  }))

  ipcMain.handle(IPC.openOutputDirectory, async (_event, kind: unknown) => {
    if (kind === 'rebuilt' && lastRebuiltPath) {
      shell.showItemInFolder(lastRebuiltPath)
      return
    }
    if (kind === 'generated' && lastGeneratedSavedPath) {
      shell.showItemInFolder(lastGeneratedSavedPath)
      return
    }
    const custom = customOutputDirectory(configStore.get())
    if (custom) await shell.openPath(custom)
  })

  ipcMain.handle(IPC.openDataDirectory, () => shell.openPath(configStore.dataRoot))
  ipcMain.handle(IPC.openAnnouncementFile, () =>
    shell.openPath(join(resourcesDirectory(), '开发公告.md'))
  )
  ipcMain.handle(IPC.openExternal, (_event, url: unknown) =>
    shell.openExternal(validateExternalUrl(url))
  )
  ipcMain.handle(IPC.openPath, (_event, target: unknown) => shell.openPath(String(target ?? '')))
  ipcMain.handle(IPC.showInFolder, (_event, target: unknown) => {
    shell.showItemInFolder(String(target ?? ''))
  })
  ipcMain.handle(IPC.copyText, (_event, text: unknown) => {
    clipboard.writeText(String(text ?? ''))
  })
  ipcMain.handle(IPC.restart, () => {
    app.relaunch()
    app.exit(0)
  })
  ipcMain.handle(IPC.minimizeWindow, () => rendererWindow().minimize())
  ipcMain.handle(IPC.toggleMaximizeWindow, (): WindowState => {
    const window = rendererWindow()
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
    return windowState()
  })
  ipcMain.handle(IPC.closeWindow, () => rendererWindow().close())
  ipcMain.handle(IPC.getWindowState, windowState)
}

function createWindow(): void {
  const iconPath = join(resourcesDirectory(), 'EzQR-Tools.ico')
  mainWindow = new BrowserWindow({
    title: APP_NAME,
    width: 1120,
    height: 780,
    minWidth: 980,
    minHeight: 700,
    show: false,
    frame: false,
    resizable: true,
    maximizable: true,
    backgroundColor: '#050b12',
    icon: iconPath,
    webPreferences: {
      preload: join(moduleDirectory, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: isDevelopment
    }
  })

  mainWindow.setMenuBarVisibility(false)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })
  mainWindow.on('maximize', () => send(IPC.windowStateChanged, windowState()))
  mainWindow.on('unmaximize', () => send(IPC.windowStateChanged, windowState()))
  mainWindow.on('enter-full-screen', () => send(IPC.windowStateChanged, windowState()))
  mainWindow.on('leave-full-screen', () => send(IPC.windowStateChanged, windowState()))
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(moduleDirectory, '../renderer/index.html'))
  }
}

async function initialize(): Promise<void> {
  const programDir = app.isPackaged ? dirname(process.execPath) : app.getAppPath()
  configStore = await ConfigStore.create({
    programDir,
    userDataDir: app.getPath('userData'),
    dataRootOverride: process.env.QRTOOL_DATA_ROOT
  })
  historyStore = new HistoryStore(configStore.configDir, configStore.get().historyLimit)
  await historyStore.load()
  announcementStore = new AnnouncementStore(join(resourcesDirectory(), '开发公告.md'))

  protocol.handle(MEDIA_SCHEME, async (request) => {
    const url = new URL(request.url)
    const token = url.pathname.replace(/^\/+/, '')
    return (await mediaStore.resolve(token)) ?? new Response('Not found', { status: 404 })
  })

  registerIpc()
  createWindow()
}

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
  app.whenReady().then(async () => {
    app.setAppUserModelId(APP_USER_MODEL_ID)
    try {
      await initialize()
    } catch (error) {
      dialog.showErrorBox('EzQR-Tools 启动失败', messageFromError(error))
      app.quit()
    }
  })
  app.on('window-all-closed', () => app.quit())
}

