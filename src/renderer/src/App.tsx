import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlasmaRuntime } from '@cruxgarden/plasma-ui'
import type {
  ApiStatus,
  AppSettingsView,
  BootstrapData,
  DecodeResult,
  GenerateResult,
  HistoryRecord,
  MediaSelection,
  OperationProgress,
  RebuildResult,
  SettingsPatch,
  UpdateInfo,
  WindowState,
  WorkspaceId
} from '../../shared/types'
import { Footer } from './components/Footer'
import { HistoryDialog } from './components/HistoryDialog'
import { PlasmaShell } from './components/PlasmaShell'
import { PreviewDock } from './components/PreviewDock'
import { TitleBar } from './components/TitleBar'
import { WorkspaceNav } from './components/WorkspaceNav'
import { paletteStyle } from './lib/appearance'
import { createOperationId, errorMessage, normalizeQrImage } from './lib/image'
import { AnnouncementDialog } from './overlays/AnnouncementDialog'
import { AlertDialog, type AlertState } from './overlays/AlertDialog'
import { SettingsDialog } from './overlays/SettingsDialog'
import { GeneratePage } from './pages/GeneratePage'
import { RebuildPage } from './pages/RebuildPage'
import { DecodePage } from './pages/DecodePage'
import type { UiStatus } from './types'

type DialogName = 'settings' | 'announcement' | 'history' | null

function mergePatch(base: SettingsPatch, incoming: SettingsPatch): SettingsPatch {
  return {
    ...base,
    ...incoming,
    api: base.api || incoming.api ? { ...base.api, ...incoming.api } : undefined,
    qr: base.qr || incoming.qr ? { ...base.qr, ...incoming.qr } : undefined,
    appearance:
      base.appearance || incoming.appearance
        ? {
            ...base.appearance,
            ...incoming.appearance,
            material:
              base.appearance?.material || incoming.appearance?.material
                ? { ...base.appearance?.material, ...incoming.appearance?.material }
                : undefined
          }
        : undefined,
    output:
      base.output || incoming.output ? { ...base.output, ...incoming.output } : undefined
  }
}

function applyPatchLocally(current: AppSettingsView, patch: SettingsPatch): AppSettingsView {
  return {
    ...current,
    api: {
      ...current.api,
      ...(patch.api?.baseUrl !== undefined ? { baseUrl: patch.api.baseUrl } : {}),
      ...(patch.api?.timeoutSeconds !== undefined
        ? { timeoutSeconds: patch.api.timeoutSeconds }
        : {}),
      ...(patch.api?.apiKey !== undefined ? { hasApiKey: Boolean(patch.api.apiKey) } : {})
    },
    qr: { ...current.qr, ...patch.qr },
    historyLimit: patch.historyLimit ?? current.historyLimit,
    appearance: {
      ...current.appearance,
      ...(patch.appearance?.palette !== undefined
        ? { palette: patch.appearance.palette }
        : {}),
      ...(patch.appearance?.backgroundImage !== undefined
        ? { backgroundImage: patch.appearance.backgroundImage }
        : {}),
      material: {
        ...current.appearance.material,
        ...patch.appearance?.material
      }
    },
    output: { ...current.output, ...patch.output }
  }
}

function RendererFallbackNotice(): React.JSX.Element | null {
  const { supported } = usePlasmaRuntime()
  if (supported) return null
  return (
    <div className="webgl-warning" role="status">
      当前显卡未启用 WebGL2，已切换到轻量磨砂模式，功能仍可正常使用。
    </div>
  )
}

function Workspace({ boot }: { boot: BootstrapData }): React.JSX.Element {
  const [workspace, setWorkspace] = useState<WorkspaceId>('rebuild')
  const [settings, setSettings] = useState(boot.settings)
  const [history, setHistory] = useState(boot.history)
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    ok: null,
    message: '在线接口：未检测',
    checkedAt: null
  })
  const [apiBusy, setApiBusy] = useState(false)
  const [windowState, setWindowState] = useState<WindowState>({ maximized: false })
  const [dialog, setDialog] = useState<DialogName>(null)
  const [alert, setAlert] = useState<AlertState | null>(null)
  const [toast, setToast] = useState('')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [updateBusy, setUpdateBusy] = useState(false)
  const toastTimer = useRef<number | null>(null)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)

  const [rebuildBusy, setRebuildBusy] = useState(false)
  const rebuildInFlight = useRef(false)
  const [rebuildSelection, setRebuildSelection] = useState<MediaSelection | null>(null)
  const [rebuildStatus, setRebuildStatus] = useState<UiStatus>({
    kind: 'idle',
    message: '等待选择图片…'
  })
  const [rebuildResult, setRebuildResult] = useState<RebuildResult | null>(null)

  const [decodeBusy, setDecodeBusy] = useState(false)
  const decodeInFlight = useRef(false)
  const decodeOperation = useRef('')
  const [decodeSelection, setDecodeSelection] = useState<MediaSelection | null>(null)
  const [decodeResult, setDecodeResult] = useState<DecodeResult | null>(null)
  const [decodeStatus, setDecodeStatus] = useState<UiStatus>({ kind: 'idle', message: '等待选择图片…' })

  const [content, setContent] = useState('')
  const [generateBusy, setGenerateBusy] = useState(false)
  const [generateStatus, setGenerateStatus] = useState<UiStatus>({
    kind: 'idle',
    message: '等待输入内容…'
  })
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null)
  const [fileMessage, setFileMessage] = useState('')
  const [fileWarning, setFileWarning] = useState(false)
  const [lastSavedPath, setLastSavedPath] = useState('')

  const activeOperation = useRef('')
  const pendingPatch = useRef<SettingsPatch>({})
  const queuedPatches = useRef<SettingsPatch[]>([])
  const settingsWriteQueue = useRef<Promise<void>>(Promise.resolve())
  const settingsTimer = useRef<number | null>(null)

  const receiveSettings = useCallback((next: AppSettingsView): void => {
    const queued = queuedPatches.current.reduce(mergePatch, {})
    setSettings(applyPatchLocally(next, mergePatch(queued, pendingPatch.current)))
  }, [])

  const showToast = useCallback((message: string): void => {
    setToast(message)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }, [])

  const openAlert = useCallback((next: AlertState): void => {
    setDialog(null)
    setAlert(next)
  }, [])

  const checkApi = useCallback(async (): Promise<void> => {
    setApiBusy(true)
    setApiStatus((current) => ({ ...current, ok: null, message: '在线接口：检测中…' }))
    try {
      setApiStatus(await window.qrTool.checkApi())
    } catch (error) {
      setApiStatus({
        ok: false,
        message: `接口状态：${errorMessage(error)}`,
        checkedAt: new Date().toISOString()
      })
    } finally {
      setApiBusy(false)
    }
  }, [])

  const checkUpdates = useCallback(async (): Promise<void> => {
    setUpdateBusy(true)
    try {
      setUpdateInfo(await window.qrTool.checkForUpdates())
    } catch (error) {
      setUpdateInfo({
        status: 'error',
        currentVersion: boot.appVersion,
        message: `检查更新失败：${errorMessage(error)}`,
        checkedAt: new Date().toISOString()
      })
    } finally {
      setUpdateBusy(false)
    }
  }, [boot.appVersion])

  useEffect(() => {
    const timer = window.setTimeout(() => void checkUpdates(), 900)
    return () => window.clearTimeout(timer)
  }, [checkUpdates])

  useEffect(() => {
    void window.qrTool.getWindowState().then(setWindowState)
    const unsubscribers = [
      window.qrTool.onHistoryChanged(setHistory),
      window.qrTool.onSettingsChanged(receiveSettings),
      window.qrTool.onWindowStateChanged(setWindowState),
      window.qrTool.onToast(showToast)
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [receiveSettings, showToast])

  useEffect(() => {
    if (boot.warnings[0]) showToast(boot.warnings[0])
  }, [boot.warnings, showToast])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key === '1') {
        event.preventDefault()
        setWorkspace('rebuild')
      } else if (event.key === '2') {
        event.preventDefault()
        setWorkspace('generate')
      } else if (event.key === '3') {
        event.preventDefault()
        setWorkspace('decode')
      } else if (event.key.toLowerCase() === 'h') {
        if (!alert && (!dialog || dialog === 'history')) {
          event.preventDefault()
          setDialog(dialog === 'history' ? null : 'history')
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [alert, dialog])

  const writeSettings = useCallback(
    (patch: SettingsPatch): Promise<void> => {
      queuedPatches.current.push(patch)
      const write = settingsWriteQueue.current.then(async () => {
        try {
          const next = await window.qrTool.updateSettings(patch)
          queuedPatches.current.shift()
          receiveSettings(next)
        } catch (error) {
          queuedPatches.current.shift()
          throw error
        }
      })
      // A failed write must not prevent later user changes from being saved.
      settingsWriteQueue.current = write.catch(() => undefined)
      return write
    },
    [receiveSettings]
  )

  const flushSettings = useCallback(async (): Promise<void> => {
    if (settingsTimer.current !== null) {
      window.clearTimeout(settingsTimer.current)
      settingsTimer.current = null
    }
    const patch = pendingPatch.current
    pendingPatch.current = {}
    if (!Object.keys(patch).length) return
    await writeSettings(patch)
  }, [writeSettings])

  const scheduleSettingsPatch = useCallback(
    (patch: SettingsPatch): void => {
      setSettings((current) => applyPatchLocally(current, patch))
      pendingPatch.current = mergePatch(pendingPatch.current, patch)
      if (settingsTimer.current !== null) window.clearTimeout(settingsTimer.current)
      settingsTimer.current = window.setTimeout(() => {
        void flushSettings().catch((error: unknown) => {
          showToast(`保存设置失败：${errorMessage(error)}`)
        })
      }, 200)
    },
    [flushSettings, showToast]
  )

  const updateSettingsNow = useCallback(
    async (patch: SettingsPatch): Promise<void> => {
      setSettings((current) => applyPatchLocally(current, patch))
      pendingPatch.current = mergePatch(pendingPatch.current, patch)
      try {
        await flushSettings()
      } catch (error) {
        showToast(`保存设置失败：${errorMessage(error)}`)
        throw error
      }
    },
    [flushSettings, showToast]
  )

  const beginDecode = useCallback(async (selection: MediaSelection): Promise<void> => {
    if (decodeInFlight.current) return
    decodeInFlight.current = true
    const operationId = createOperationId('decode')
    decodeOperation.current = operationId
    setDecodeBusy(true)
    setDecodeSelection(selection)
    setDecodeResult(null)
    setDecodeStatus({ kind: 'busy', message: '正在读取并转换图片…' })
    try {
      // Refresh the media URL on retry, including when the same file was repaired.
      const source = await window.qrTool.prepareDroppedImage(selection.path)
      setDecodeSelection(source)
      const normalizedPng = await normalizeQrImage(source.previewUrl)
      const result = await window.qrTool.decode({ operationId, path: source.path, normalizedPng })
      setDecodeSelection({ ...source, previewUrl: result.sourcePreviewUrl })
      setDecodeResult(result)
      setDecodeStatus({ kind: 'success', message: `解析完成，识别到 ${result.contents.length} 个二维码` })
    } catch (error) {
      setDecodeStatus({ kind: 'error', message: errorMessage(error) })
    } finally {
      decodeInFlight.current = false
      decodeOperation.current = ''
      setDecodeBusy(false)
    }
  }, [])

  const chooseDecodeImage = useCallback(async (): Promise<void> => {
    if (decodeInFlight.current) return
    try {
      const selection = await window.qrTool.chooseImage()
      if (selection) await beginDecode(selection)
    } catch (error) {
      setDecodeResult(null)
      setDecodeSelection(null)
      setDecodeStatus({ kind: 'error', message: errorMessage(error) })
    }
  }, [beginDecode])

  const beginRebuild = useCallback(
    async (selection: MediaSelection): Promise<void> => {
      if (rebuildInFlight.current) return
      rebuildInFlight.current = true
      const qr = { ...settings.qr }
      setWorkspace('rebuild')
      setRebuildSelection(selection)
      const operationId = createOperationId('rebuild')
      activeOperation.current = operationId
      setRebuildBusy(true)
      setRebuildResult(null)
      setRebuildStatus({ kind: 'busy', message: '正在读取并转换图片…' })
      try {
        const normalizedPng = await normalizeQrImage(selection.previewUrl)
        const result = await window.qrTool.rebuild({
          operationId,
          path: selection.path,
          qr,
          normalizedPng: qr.engine === 'local' ? normalizedPng : undefined
        })
        setRebuildResult(result)
        const extra =
          result.contents.length > 1
            ? `（共检测到 ${result.contents.length} 个二维码，已取第一个）`
            : ''
        setRebuildStatus({ kind: 'success', message: `重构完成${extra}` })
        showToast('二维码重构成功')
      } catch (error) {
        setRebuildStatus({ kind: 'error', message: errorMessage(error) })
      } finally {
        rebuildInFlight.current = false
        setRebuildBusy(false)
        activeOperation.current = ''
      }
    },
    [settings.qr, showToast]
  )

  const chooseImage = useCallback(async (): Promise<void> => {
    if (rebuildInFlight.current) return
    try {
      const selection = await window.qrTool.chooseImage()
      if (selection) await beginRebuild(selection)
    } catch (error) {
      setRebuildStatus({ kind: 'error', message: errorMessage(error) })
    }
  }, [beginRebuild])

  const beginGenerate = useCallback(async (): Promise<void> => {
    if (!content.trim()) {
      setGenerateStatus({ kind: 'error', message: '请先输入要生成二维码的内容' })
      return
    }
    const operationId = createOperationId('generate')
    activeOperation.current = operationId
    setGenerateBusy(true)
    setGenerateStatus({ kind: 'busy', message: '正在生成二维码…' })
    try {
      const result = await window.qrTool.generate({
        operationId,
        content,
        qr: { ...settings.qr }
      })
      setGenerateResult(result)
      setLastSavedPath('')
      setGenerateStatus({ kind: 'success', message: '生成成功，可下载保存' })
    } catch (error) {
      setGenerateStatus({ kind: 'error', message: errorMessage(error) })
    } finally {
      setGenerateBusy(false)
      activeOperation.current = ''
    }
  }, [content, settings.qr])

  const saveGenerated = useCallback(async (): Promise<void> => {
    try {
      const result = await window.qrTool.saveQr(createOperationId('save'))
      if (!result) return
      setLastSavedPath(result.savedPath)
      setGenerateStatus({ kind: 'success', message: `已保存：${result.savedPath}` })
      showToast('二维码已保存')
    } catch (error) {
      setGenerateStatus({ kind: 'error', message: errorMessage(error) })
    }
  }, [showToast])

  const importText = useCallback(async (): Promise<void> => {
    try {
      const result = await window.qrTool.chooseTextFile()
      if (!result) return
      if (result.ok) {
        setContent(result.text)
        setFileMessage(result.message || `已读取 ${result.name}（${result.chars} 字符）`)
        setFileWarning(Boolean(result.message))
        return
      }
      setFileMessage(result.message)
      setFileWarning(true)
      if (result.tooLong) {
        openAlert({ title: '内容过长', message: result.message })
      }
    } catch (error) {
      const message = errorMessage(error)
      setFileMessage(message)
      setFileWarning(true)
    }
  }, [openAlert])

  const handleProgress = useCallback((event: OperationProgress): void => {
    if (event.kind === 'decode') {
      if (decodeOperation.current && event.operationId === decodeOperation.current) {
        setDecodeStatus({ kind: 'busy', message: event.message })
      }
      return
    }
    if (!activeOperation.current || event.operationId !== activeOperation.current) return
    if (event.kind === 'rebuild') {
      setRebuildStatus({ kind: 'busy', message: event.message })
    } else if (event.kind === 'generate') {
      setGenerateStatus({ kind: 'busy', message: event.message })
    }
  }, [])

  useEffect(() => window.qrTool.onProgress(handleProgress), [handleProgress])

  const copyText = useCallback(
    async (text: string): Promise<void> => {
      await window.qrTool.copyText(text)
      showToast(text.length > 40 ? '内容已复制' : `已复制：${text}`)
    },
    [showToast]
  )

  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>): Promise<void> => {
      event.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      const decodeOnly = workspace === 'decode'
      if (decodeOnly ? decodeInFlight.current : rebuildInFlight.current) return
      const file = event.dataTransfer.files[0]
      if (!file) return
      try {
        const filePath = window.qrTool.pathForFile(file)
        if (!filePath) throw new Error('无法获取拖入文件的本地路径')
        const selection = await window.qrTool.prepareDroppedImage(filePath)
        if (decodeOnly) await beginDecode(selection)
        else await beginRebuild(selection)
      } catch (error) {
        if (decodeOnly) {
          setDecodeResult(null)
          setDecodeSelection(null)
          setDecodeStatus({ kind: 'error', message: errorMessage(error) })
        } else {
          setWorkspace('rebuild')
          setRebuildStatus({ kind: 'error', message: errorMessage(error) })
        }
      }
    },
    [beginRebuild, beginDecode, workspace]
  )

  const reuseHistory = useCallback(
    (record: HistoryRecord): void => {
      setContent(record.content)
      setWorkspace('generate')
      setDialog(null)
      showToast('历史内容已回填')
    },
    [showToast]
  )

  const requestClearHistory = useCallback((): void => {
    openAlert({
      title: '清空历史记录',
      message: '将删除全部生成与重构记录，此操作无法撤销。',
      confirmLabel: '清空',
      onConfirm: async () => {
        setHistory(await window.qrTool.clearHistory())
        showToast('历史记录已清空')
      }
    })
  }, [openAlert, showToast])

  const chooseDataDirectory = useCallback(async (): Promise<void> => {
    try {
      const result = await window.qrTool.chooseDataDirectory()
      if (!result) return
      openAlert({
        title: '数据目录已切换',
        message: result.message,
        confirmLabel: '立即重启',
        onConfirm: () => window.qrTool.restart()
      })
    } catch (error) {
      showToast(errorMessage(error))
    }
  }, [openAlert, showToast])

  const resetDataDirectory = useCallback((): void => {
    openAlert({
      title: '恢复默认数据目录',
      message: '配置与历史记录将迁回程序目录，并在重启后生效。确定继续吗？',
      confirmLabel: '恢复并重启',
      onConfirm: async () => {
        try {
          const result = await window.qrTool.resetDataDirectory()
          await window.qrTool.restart()
          showToast(result.message)
        } catch (error) {
          showToast(errorMessage(error))
        }
      }
    })
  }, [openAlert, showToast])

  return (
    <PlasmaShell
      appearance={settings.appearance}
      backgroundImageUrl={settings.backgroundImageUrl}
    >
      <div
        className="app-shell"
        style={paletteStyle(settings.appearance.palette)}
        onDragEnter={(event) => {
          event.preventDefault()
          dragDepth.current += 1
          setDragging(true)
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (dragDepth.current === 0) setDragging(false)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={(event) => void onDrop(event)}
      >
        <TitleBar
          decodeOnly={workspace === 'decode'}
          maximized={windowState.maximized}
          apiOk={apiStatus.ok}
          apiBusy={apiBusy}
          qrEngine={settings.qr.engine}
          historyOpen={dialog === 'history'}
          historyCount={history.length}
          updateAvailable={updateInfo?.status === 'available'}
          onHistory={() =>
            setDialog((current) => (current === 'history' ? null : 'history'))
          }
          onAnnouncement={() => {
            setDialog('announcement')
          }}
          onSettings={() => {
            setDialog('settings')
          }}
          onWindowState={setWindowState}
        />

        <main className="workspace-layout">
          <WorkspaceNav
            value={workspace}
            onChange={(value) => {
              setWorkspace(value)
            }}
          />

          <section className="task-area" aria-live="polite">
            {workspace === 'rebuild' ? (
              <RebuildPage
                qrEngine={settings.qr.engine}
                busy={rebuildBusy}
                status={rebuildStatus}
                result={rebuildResult}
                onRetry={rebuildSelection && rebuildStatus.kind === 'error'
                  ? () => void beginRebuild(rebuildSelection) : undefined}
                onChoose={() => void chooseImage()}
                onOpenImage={(path) => void window.qrTool.openPath(path)}
                onCopy={(text) => void copyText(text)}
              />
            ) : workspace === 'decode' ? (
              <DecodePage
                busy={decodeBusy}
                status={decodeStatus}
                result={decodeResult}
                onChoose={() => void chooseDecodeImage()}
                onRetry={decodeSelection && decodeStatus.kind === 'error'
                  ? () => void beginDecode(decodeSelection) : undefined}
                onCopy={(text) => void copyText(text)}
              />
            ) : (
              <GeneratePage
                qrEngine={settings.qr.engine}
                content={content}
                busy={generateBusy}
                status={generateStatus}
                fileMessage={fileMessage}
                fileWarning={fileWarning}
                onContentChange={setContent}
                onGenerate={() => void beginGenerate()}
                onImportText={() => void importText()}
                onCopy={(text) => void copyText(text)}
              />
            )}
          </section>

          <div className="preview-area">
            <PreviewDock
              decodeSelection={decodeSelection}
              workspace={workspace}
              rebuildResult={rebuildResult}
              generateResult={generateResult}
              lastSavedPath={lastSavedPath}
              onOpenImage={(path) => void window.qrTool.openPath(path)}
              onOpenFolder={(kind) => void window.qrTool.openOutputDirectory(kind)}
              onSave={() => void saveGenerated()}
            />
          </div>
        </main>

        <Footer
          decodeOnly={workspace === 'decode'}
          appVersion={boot.appVersion}
          authorEmail={boot.authorEmail}
          apiStatus={apiStatus}
          apiBusy={apiBusy}
          qrEngine={settings.qr.engine}
          onRecheck={() => void checkApi()}
          onCopyEmail={() => void copyText(boot.authorEmail)}
        />

        {dragging && (
          <div className="drop-overlay" aria-hidden="true">
            <div>
              <strong>释放以解析二维码</strong>
              <span>{workspace === 'decode' ? '仅在本机解析，不生成新图片' : '图片会自动进入重构工作区'}</span>
            </div>
          </div>
        )}
        <RendererFallbackNotice />
        {toast && (
          <div className="toast" role="status" aria-live="polite">
            {toast}
          </div>
        )}

        {dialog === 'settings' && (
          <SettingsDialog
            appVersion={boot.appVersion}
            settings={settings}
            updateInfo={updateInfo}
            updateBusy={updateBusy}
            onClose={() => setDialog(null)}
            onPatch={scheduleSettingsPatch}
            onChooseBackground={async () => {
              try {
                const next = await window.qrTool.chooseBackgroundImage()
                if (next) receiveSettings(next)
              } catch (error) {
                showToast(errorMessage(error))
              }
            }}
            onClearBackground={async () => {
              try {
                receiveSettings(await window.qrTool.clearBackgroundImage())
              } catch (error) {
                showToast(errorMessage(error))
              }
            }}
            onChooseOutput={async () => {
              try {
                const directory = await window.qrTool.chooseOutputDirectory()
                if (directory) {
                  await updateSettingsNow({ output: { mode: 'custom', directory } })
                }
              } catch {
                // 错误已经由 updateSettingsNow 提示。
              }
            }}
            onChooseDataDirectory={() => void chooseDataDirectory()}
            onResetDataDirectory={resetDataDirectory}
            onSetApiKey={(apiKey) => updateSettingsNow({ api: { apiKey } })}
            onCheckForUpdates={() => void checkUpdates()}
            onToast={showToast}
          />
        )}
        {dialog === 'announcement' && (
          <AnnouncementDialog
            appVersion={boot.appVersion}
            appearance={settings.appearance}
            content={boot.announcementMarkdown}
            editable={boot.announcementEditable}
            onClose={() => setDialog(null)}
            onOpenFile={() => void window.qrTool.openAnnouncementFile()}
          />
        )}
        {dialog === 'history' && (
          <HistoryDialog
            appearance={settings.appearance}
            records={history}
            onClose={() => setDialog(null)}
            onReuse={reuseHistory}
            onOpenPath={(path) => void window.qrTool.openPath(path)}
            onClear={requestClearHistory}
          />
        )}
        {alert && (
          <AlertDialog
            appearance={settings.appearance}
            state={alert}
            onClose={() => setAlert(null)}
          />
        )}
      </div>
    </PlasmaShell>
  )
}

function LoadingScreen({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="loading-screen">
      <div className="loading-orb">
        <img src="./logo.png" alt="" />
      </div>
      <strong>易码 EzQR-Tools</strong>
      <span>{message}</span>
    </div>
  )
}

export default function App(): React.JSX.Element {
  const [boot, setBoot] = useState<BootstrapData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    window.qrTool
      .bootstrap()
      .then((data) => {
        if (active) setBoot(data)
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason))
      })
    return () => {
      active = false
    }
  }, [])

  if (error) {
    return (
      <div className="fatal-screen">
        <strong>程序启动失败</strong>
        <p>{error}</p>
      </div>
    )
  }
  if (!boot) return <LoadingScreen message="正在准备浅色玻璃界面…" />

  return <Workspace boot={boot} />
}

