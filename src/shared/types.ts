export type WorkspaceId = 'rebuild' | 'generate' | 'decode'

export type PaletteName = 'mistBlue' | 'sakuraPink' | 'mintGreen'
export type ErrorCorrection = 'L' | 'M' | 'Q' | 'H'
export type QrEngineId = 'local' | 'caoliao'
export type OutputMode = 'source' | 'custom'
export type StatusKind = 'idle' | 'busy' | 'success' | 'error'

export interface MaterialSettings {
  backgroundBlur: number
  refraction: number
  dispersion: number
  highlight: number
  frost: number
  elevation: number
  viscosity: number
}

export interface AppearanceSettings {
  palette: PaletteName
  backgroundImage: string
  material: MaterialSettings
}

export interface OutputSettings {
  mode: OutputMode
  directory: string
}

export interface QrOptions {
  size: number
  errorCorrection: ErrorCorrection
  border: number
}

export interface QrSettings extends QrOptions {
  engine: QrEngineId
}

export interface ApiConfig {
  baseUrl: string
  apiKey: string
  timeoutSeconds: number
}

export interface AppConfig {
  schemaVersion: 2
  api: ApiConfig
  qr: QrSettings
  historyLimit: number
  appearance: AppearanceSettings
  output: OutputSettings
}

export interface ApiSettingsView {
  baseUrl: string
  timeoutSeconds: number
  hasApiKey: boolean
}

export interface AppSettingsView {
  api: ApiSettingsView
  qr: QrSettings
  historyLimit: number
  appearance: AppearanceSettings
  output: OutputSettings
  dataRoot: string
  backgroundImageUrl: string
  backgroundImageName: string
}

export interface SettingsPatch {
  api?: {
    apiKey?: string
    baseUrl?: string
    timeoutSeconds?: number
  }
  qr?: Partial<QrSettings>
  historyLimit?: number
  appearance?: {
    palette?: PaletteName
    backgroundImage?: string
    material?: Partial<MaterialSettings>
  }
  output?: Partial<OutputSettings>
}

export interface HistoryRecord {
  id: string
  time: string
  type: 'generate' | 'rebuild'
  content: string
  savedPath: string
}

export interface ApiStatus {
  ok: boolean | null
  message: string
  checkedAt: string | null
}

export type UpdateCheckStatus = 'available' | 'upToDate' | 'error'

export interface UpdateInfo {
  status: UpdateCheckStatus
  currentVersion: string
  latestVersion?: string
  releaseUrl?: string
  publishedAt?: string
  message: string
  checkedAt: string
}

export interface MediaSelection {
  path: string
  previewUrl: string
  name: string
}

export interface GeneratedPreview {
  previewUrl: string
}

export interface RebuildResult {
  contents: string[]
  content: string
  sourcePath: string
  savedPath: string
  sourcePreviewUrl: string
  rebuiltPreviewUrl: string
}

export interface DecodeResult {
  contents: string[]
  sourcePath: string
  sourcePreviewUrl: string
}

export interface DecodeRequest {
  operationId: string
  path: string
  normalizedPng: Uint8Array
}

export interface GenerateResult {
  info: string
  previewUrl: string
  recordId: string
}

export interface SaveQrResult {
  savedPath: string
}

export interface TextImportResult {
  ok: boolean
  tooLong: boolean
  chars: number
  name: string
  text: string
  message: string
}

export interface OperationProgress {
  operationId: string
  kind: 'rebuild' | 'generate' | 'decode' | 'api' | 'save'
  message: string
}

export interface WindowState {
  maximized: boolean
}

export interface DataRootChange {
  changed: boolean
  message: string
}

export interface BootstrapData {
  appVersion: string
  authorEmail: string
  announcementEditable: boolean
  settings: AppSettingsView
  history: HistoryRecord[]
  announcementMarkdown: string
  warnings: string[]
}

export interface RebuildRequest {
  normalizedPng?: Uint8Array
  operationId: string
  path: string
  qr?: QrSettings
}

export interface GenerateRequest {
  operationId: string
  content: string
  qr?: QrSettings
}

export interface AppErrorPayload {
  code: string
  message: string
}

export interface QrToolApi {
  bootstrap(): Promise<BootstrapData>
  chooseImage(): Promise<MediaSelection | null>
  prepareDroppedImage(path: string): Promise<MediaSelection>
  rebuild(request: RebuildRequest): Promise<RebuildResult>
  decode(request: DecodeRequest): Promise<DecodeResult>
  generate(request: GenerateRequest): Promise<GenerateResult>
  saveQr(operationId: string): Promise<SaveQrResult | null>
  chooseTextFile(): Promise<TextImportResult | null>
  getHistory(): Promise<HistoryRecord[]>
  clearHistory(): Promise<HistoryRecord[]>
  checkApi(): Promise<ApiStatus>
  checkForUpdates(): Promise<UpdateInfo>
  updateSettings(patch: SettingsPatch): Promise<AppSettingsView>
  chooseBackgroundImage(): Promise<AppSettingsView | null>
  clearBackgroundImage(): Promise<AppSettingsView>
  chooseOutputDirectory(): Promise<string | null>
  chooseDataDirectory(): Promise<DataRootChange | null>
  resetDataDirectory(): Promise<DataRootChange>
  openOutputDirectory(kind: 'rebuilt' | 'generated'): Promise<void>
  openDataDirectory(): Promise<void>
  openAnnouncementFile(): Promise<void>
  openExternal(url: string): Promise<void>
  openPath(path: string): Promise<void>
  showInFolder(path: string): Promise<void>
  copyText(text: string): Promise<void>
  restart(): Promise<void>
  minimizeWindow(): Promise<void>
  toggleMaximizeWindow(): Promise<WindowState>
  closeWindow(): Promise<void>
  getWindowState(): Promise<WindowState>
  pathForFile(file: File): string
  onProgress(listener: (event: OperationProgress) => void): () => void
  onHistoryChanged(listener: (records: HistoryRecord[]) => void): () => void
  onSettingsChanged(listener: (settings: AppSettingsView) => void): () => void
  onWindowStateChanged(listener: (state: WindowState) => void): () => void
  onToast(listener: (message: string) => void): () => void
}

