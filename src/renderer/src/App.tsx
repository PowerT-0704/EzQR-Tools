import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlasmaRuntime } from '@cruxgarden/plasma-ui'
import type {
  ApiStatus,
  AppSettingsView,
  BootstrapData,
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
import { createOperationId, errorMessage, imageLoads } from './lib/image'
import { AnnouncementDialog } from './overlays/AnnouncementDialog'
import { AlertDialog, type AlertState } from './overlays/AlertDialog'
import { SettingsDialog } from './overlays/SettingsDialog'
import { GeneratePage } from './pages/GeneratePage'
import { RebuildPage } from './pages/RebuildPage'
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
    message: '接口状态：检测中…',
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
  const [rebuildStatus, setRebuildStatus] = useState<UiStatus>({
    kind: 'idle',
    message: '等待选择图片…'
  })
  const [rebuildResult, setRebuildResult] = useState<RebuildResult | null>(null)

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
  const settingsTimer = useRef<number | null>(null)

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
    setApiStatus((current) => ({ ...current, ok: null, message: '接口状态：检测中…' }))
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
    const timer = window.setTimeout(() => void checkApi(), 450)
    return () => window.clearTimeout(timer)
  }, [checkApi])

  useEffect(() => {
    const timer = window.setTimeout(() => void checkUpdates(), 900)
    return () => window.clearTimeout(timer)
  }, [checkUpdates])

  useEffect(() => {
    void window.qrTool.getWindowState().then(setWindowState)
    const unsubscribers = [
      window.qrTool.onHistoryChanged(setHistory),
      window.qrTool.onSettingsChanged(setSettings),
      window.qrTool.onWindowStateChanged(setWindowState),
      window.qrTool.onToast(showToast)
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [showToast])

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

  const flushSettings = useCallback(async (): Promise<void> => {
    if (settingsTimer.current !== null) {
      window.clearTimeout(settingsTimer.current)
      settingsTimer.current = null
    }
    const patch = pendingPatch.current
    pendingPatch.current = {}
    if (!Object.keys(patch).length) return
    try {
      setSettings(await window.qrTool.updateSettings(patch))
    } catch (error) {
      showToast(`保存设置失败：${errorMessage(error)}`)
    }
  }, [showToast])

  const scheduleSettingsPatch = useCallback(
    (patch: SettingsPatch): void => {
      setSettings((current) => applyPatchLocally(current, patch))
      pendingPatch.current = mergePatch(pendingPatch.current, patch)
      if (settingsTimer.current !== null) window.clearTimeout(settingsTimer.current)
      settingsTimer.current = window.setTimeout(() => void flushSettings(), 200)
    },
    [flushSettings]
  )

  const updateSettingsNow = useCallback(
    async (patch: SettingsPatch): Promise<void> => {
      try {
        setSettings(await window.qrTool.updateSettings(patch))
      } catch (error) {
        showToast(`保存设置失败：${errorMessage(error)}`)
        throw error
      }
    },
    [showToast]
  )

  const beginRebuild = useCallback(
    async (selection: MediaSelection): Promise<void> => {
      setWorkspace('rebuild')
      const valid = await imageLoads(selection.previewUrl)
      if (!valid) {
        setRebuildStatus({ kind: 'error', message: '图片无法读取，请换一张图片重试' })
        return
      }
      const operationId = createOperationId('rebuild')
      activeOperation.current = operationId
      setRebuildBusy(true)
      setRebuildResult(null)
      setRebuildStatus({ kind: 'busy', message: '准备上传图片…' })
      try {
        const result = await window.qrTool.rebuild({ operationId, path: selection.path })
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
        setRebuildBusy(false)
        activeOperation.current = ''
      }
    },
    [showToast]
  )

  const chooseImage = useCallback(async (): Promise<void> => {
    try {
      const selection = await window.qrTool.chooseImage()
      if (selection) await beginRebuild(selection)
    } catch (error) {
      setRebuildStatus({ kind: 'error', message: errorMessage(error) })
    }
  }, [beginRebuild])

  const beginGenerate = useCallback(async (): Promise<void> => {
    const normalized = content.trim()
    if (!normalized) {
      setGenerateStatus({ kind: 'error', message: '请先输入要生成二维码的内容' })
      return
    }
    const operationId = createOperationId('generate')
    activeOperation.current = operationId
    setGenerateBusy(true)
    setGenerateStatus({ kind: 'busy', message: '正在生成二维码…' })
    try {
      const result = await window.qrTool.generate({ operationId, content: normalized })
      setGenerateResult(result)
      setLastSavedPath('')
      setGenerateStatus({ kind: 'success', message: '生成成功，可下载保存' })
    } catch (error) {
      setGenerateStatus({ kind: 'error', message: errorMessage(error) })
    } finally {
      setGenerateBusy(false)
      activeOperation.current = ''
    }
  }, [content])

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
      const file = event.dataTransfer.files[0]
      if (!file) return
      try {
        const filePath = window.qrTool.pathForFile(file)
        if (!filePath) throw new Error('无法获取拖入文件的本地路径')
        const selection = await window.qrTool.prepareDroppedImage(filePath)
        await beginRebuild(selection)
      } catch (error) {
        setWorkspace('rebuild')
        setRebuildStatus({ kind: 'error', message: errorMessage(error) })
      }
    },
    [beginRebuild]
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
          maximized={windowState.maximized}
          apiOk={apiStatus.ok}
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
                busy={rebuildBusy}
                status={rebuildStatus}
                result={rebuildResult}
                onChoose={() => void chooseImage()}
                onOpenImage={(path) => void window.qrTool.openPath(path)}
                onCopy={(text) => void copyText(text)}
              />
            ) : (
              <GeneratePage
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
          appVersion={boot.appVersion}
          authorEmail={boot.authorEmail}
          apiStatus={apiStatus}
          apiBusy={apiBusy}
          onRecheck={() => void checkApi()}
          onCopyEmail={() => void copyText(boot.authorEmail)}
        />

        {dragging && (
          <div className="drop-overlay" aria-hidden="true">
            <div>
              <strong>释放以解析二维码</strong>
              <span>图片会自动进入重构工作区</span>
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
                if (next) setSettings(next)
              } catch (error) {
                showToast(errorMessage(error))
              }
            }}
            onClearBackground={async () => {
              try {
                setSettings(await window.qrTool.clearBackgroundImage())
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

