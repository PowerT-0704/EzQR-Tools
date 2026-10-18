import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC } from '../shared/channels'
import type {
  BootstrapData,
  DataRootChange,
  AppSettingsView,
  ApiStatus,
  GenerateRequest,
  GenerateResult,
  HistoryRecord,
  MediaSelection,
  OperationProgress,
  QrToolApi,
  RebuildRequest,
  RebuildResult,
  SaveQrResult,
  SettingsPatch,
  TextImportResult,
  UpdateInfo,
  WindowState
} from '../shared/types'

function cleanInvokeError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : String(error)
  const cleaned = raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
  return new Error(cleaned || '操作失败')
}

async function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  try {
    return (await ipcRenderer.invoke(channel, payload)) as T
  } catch (error) {
    throw cleanInvokeError(error)
  }
}

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: Electron.IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const api: QrToolApi = {
  bootstrap: () => invoke<BootstrapData>(IPC.bootstrap),
  chooseImage: () => invoke<MediaSelection | null>(IPC.chooseImage),
  prepareDroppedImage: (path) =>
    invoke<MediaSelection>(IPC.prepareDroppedImage, path),
  rebuild: (request: RebuildRequest) => invoke<RebuildResult>(IPC.rebuild, request),
  generate: (request: GenerateRequest) => invoke<GenerateResult>(IPC.generate, request),
  saveQr: (operationId: string) => invoke<SaveQrResult | null>(IPC.saveQr, operationId),
  chooseTextFile: () => invoke<TextImportResult | null>(IPC.chooseTextFile),
  getHistory: () => invoke<HistoryRecord[]>(IPC.getHistory),
  clearHistory: () => invoke<HistoryRecord[]>(IPC.clearHistory),
  checkApi: () => invoke<ApiStatus>(IPC.checkApi),
  checkForUpdates: () => invoke<UpdateInfo>(IPC.checkForUpdates),
  updateSettings: (patch: SettingsPatch) =>
    invoke<AppSettingsView>(IPC.updateSettings, patch),
  chooseBackgroundImage: () =>
    invoke<AppSettingsView | null>(IPC.chooseBackgroundImage),
  clearBackgroundImage: () => invoke<AppSettingsView>(IPC.clearBackgroundImage),
  chooseOutputDirectory: () =>
    invoke<string | null>(IPC.chooseOutputDirectory),
  chooseDataDirectory: () =>
    invoke<DataRootChange | null>(IPC.chooseDataDirectory),
  resetDataDirectory: () =>
    invoke<DataRootChange>(IPC.resetDataDirectory),
  openOutputDirectory: (kind) => invoke<void>(IPC.openOutputDirectory, kind),
  openDataDirectory: () => invoke<void>(IPC.openDataDirectory),
  openAnnouncementFile: () => invoke<void>(IPC.openAnnouncementFile),
  openExternal: (url) => invoke<void>(IPC.openExternal, url),
  openPath: (path) => invoke<void>(IPC.openPath, path),
  showInFolder: (path) => invoke<void>(IPC.showInFolder, path),
  copyText: (text) => invoke<void>(IPC.copyText, text),
  restart: () => invoke<void>(IPC.restart),
  minimizeWindow: () => invoke<void>(IPC.minimizeWindow),
  toggleMaximizeWindow: () => invoke<WindowState>(IPC.toggleMaximizeWindow),
  closeWindow: () => invoke<void>(IPC.closeWindow),
  getWindowState: () => invoke<WindowState>(IPC.getWindowState),
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  onProgress: (listener) => subscribe<OperationProgress>(IPC.progress, listener),
  onHistoryChanged: (listener) => subscribe<HistoryRecord[]>(IPC.historyChanged, listener),
  onSettingsChanged: (listener) => subscribe<AppSettingsView>(IPC.settingsChanged, listener),
  onWindowStateChanged: (listener) => subscribe<WindowState>(IPC.windowStateChanged, listener),
  onToast: (listener) => subscribe<string>(IPC.toast, listener)
}

contextBridge.exposeInMainWorld('qrTool', api)

