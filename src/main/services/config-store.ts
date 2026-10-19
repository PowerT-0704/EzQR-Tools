import { copyFile, readFile, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  DEFAULT_BASE_URL,
  DEFAULT_ERROR_CORRECTION,
  DEFAULT_HISTORY_LIMIT,
  DEFAULT_QR_BORDER,
  DEFAULT_QR_ENGINE,
  DEFAULT_QR_SIZE,
  DEFAULT_TIMEOUT_SECONDS,
  MATERIAL_LIMITS
} from '../../shared/constants'
import type {
  AppConfig,
  AppSettingsView,
  MaterialSettings,
  PaletteName
} from '../../shared/types'
import {
  ensureDirectory,
  pathIsWritable,
  readTextIfExists,
  writeTextAtomic
} from './atomic-file'

const DATA_DIR_POINTER = 'data_dir.txt'

const PALETTES: PaletteName[] = ['mistBlue', 'sakuraPink', 'mintGreen']
const CORRECTIONS = ['L', 'M', 'Q', 'H'] as const

const LEGACY_MOOD_TO_PALETTE: Record<string, PaletteName> = {
  tidal: 'mistBlue',
  aurora: 'mintGreen',
  ember: 'sakuraPink'
}

export interface ConfigStoreOptions {
  programDir: string
  userDataDir: string
  dataRootOverride?: string
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function defaultMaterial(): MaterialSettings {
  return {
    backgroundBlur: MATERIAL_LIMITS.backgroundBlur.default,
    refraction: MATERIAL_LIMITS.refraction.default,
    dispersion: MATERIAL_LIMITS.dispersion.default,
    highlight: MATERIAL_LIMITS.highlight.default,
    frost: MATERIAL_LIMITS.frost.default,
    elevation: MATERIAL_LIMITS.elevation.default,
    viscosity: MATERIAL_LIMITS.viscosity.default
  }
}

export function createDefaultConfig(): AppConfig {
  return {
    schemaVersion: 2,
    api: {
      baseUrl: DEFAULT_BASE_URL,
      apiKey: '',
      timeoutSeconds: DEFAULT_TIMEOUT_SECONDS
    },
    qr: {
      engine: DEFAULT_QR_ENGINE,
      size: DEFAULT_QR_SIZE,
      errorCorrection: DEFAULT_ERROR_CORRECTION,
      border: DEFAULT_QR_BORDER
    },
    historyLimit: DEFAULT_HISTORY_LIMIT,
    appearance: {
      palette: 'mistBlue',
      backgroundImage: '',
      material: defaultMaterial()
    },
    output: {
      mode: 'source',
      directory: ''
    }
  }
}

function sanitizeMaterial(raw: unknown): MaterialSettings {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    backgroundBlur: clamp(
      value.backgroundBlur,
      MATERIAL_LIMITS.backgroundBlur.min,
      MATERIAL_LIMITS.backgroundBlur.max,
      MATERIAL_LIMITS.backgroundBlur.default
    ),
    refraction: clamp(
      value.refraction,
      MATERIAL_LIMITS.refraction.min,
      MATERIAL_LIMITS.refraction.max,
      MATERIAL_LIMITS.refraction.default
    ),
    dispersion: clamp(
      value.dispersion,
      MATERIAL_LIMITS.dispersion.min,
      MATERIAL_LIMITS.dispersion.max,
      MATERIAL_LIMITS.dispersion.default
    ),
    highlight: clamp(
      value.highlight,
      MATERIAL_LIMITS.highlight.min,
      MATERIAL_LIMITS.highlight.max,
      MATERIAL_LIMITS.highlight.default
    ),
    frost: clamp(
      value.frost,
      MATERIAL_LIMITS.frost.min,
      MATERIAL_LIMITS.frost.max,
      MATERIAL_LIMITS.frost.default
    ),
    elevation: clamp(
      value.elevation,
      MATERIAL_LIMITS.elevation.min,
      MATERIAL_LIMITS.elevation.max,
      MATERIAL_LIMITS.elevation.default
    ),
    viscosity: clamp(
      value.viscosity,
      MATERIAL_LIMITS.viscosity.min,
      MATERIAL_LIMITS.viscosity.max,
      MATERIAL_LIMITS.viscosity.default
    )
  }
}

export function sanitizeConfig(raw: unknown): AppConfig {
  const defaults = createDefaultConfig()
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const api = source.api && typeof source.api === 'object' ? (source.api as Record<string, unknown>) : {}
  const qr = source.qr && typeof source.qr === 'object' ? (source.qr as Record<string, unknown>) : {}
  const appearance =
    source.appearance && typeof source.appearance === 'object'
      ? (source.appearance as Record<string, unknown>)
      : {}
  const output =
    source.output && typeof source.output === 'object' ? (source.output as Record<string, unknown>) : {}

  const palette = PALETTES.includes(appearance.palette as PaletteName)
    ? (appearance.palette as PaletteName)
    : LEGACY_MOOD_TO_PALETTE[String(appearance.mood)] ?? defaults.appearance.palette
  const errorCorrection = CORRECTIONS.includes(qr.errorCorrection as (typeof CORRECTIONS)[number])
    ? (qr.errorCorrection as AppConfig['qr']['errorCorrection'])
    : defaults.qr.errorCorrection
  const outputMode = output.mode === 'custom' ? 'custom' : 'source'

  return {
    schemaVersion: 2,
    api: {
      baseUrl:
        typeof api.baseUrl === 'string' && api.baseUrl.trim()
          ? api.baseUrl.trim().replace(/\/+$/, '')
          : defaults.api.baseUrl,
      apiKey: typeof api.apiKey === 'string' ? api.apiKey.trim() : '',
      timeoutSeconds: clamp(api.timeoutSeconds, 5, 120, defaults.api.timeoutSeconds)
    },
    qr: {
      engine: qr.engine === 'caoliao' ? 'caoliao' : DEFAULT_QR_ENGINE,
      size: Math.round(clamp(qr.size, 128, 4096, defaults.qr.size)),
      errorCorrection,
      border: Math.round(clamp(qr.border, 0, 16, defaults.qr.border))
    },
    historyLimit: clamp(source.historyLimit, 1, 500, defaults.historyLimit),
    appearance: {
      palette,
      backgroundImage:
        typeof appearance.backgroundImage === 'string' ? appearance.backgroundImage : '',
      material: sanitizeMaterial(appearance.material)
    },
    output: {
      mode: outputMode,
      directory: typeof output.directory === 'string' ? output.directory.trim() : ''
    }
  }
}

export class ConfigStore {
  readonly programDir: string
  readonly userDataDir: string
  readonly dataRootOverride?: string
  readonly warnings: string[] = []
  dataRoot = ''
  configDir = ''
  configPath = ''
  private config: AppConfig

  private constructor(options: ConfigStoreOptions, dataRoot: string) {
    this.programDir = options.programDir
    this.userDataDir = options.userDataDir
    this.dataRootOverride = options.dataRootOverride
    this.dataRoot = dataRoot
    this.configDir = path.join(dataRoot, 'config')
    this.configPath = path.join(this.configDir, 'config.json')
    this.config = createDefaultConfig()
  }

  static async create(options: ConfigStoreOptions): Promise<ConfigStore> {
    const preferred = await ConfigStore.resolveDataRoot(options)
    let selected = preferred.root
    if (!(await pathIsWritable(path.join(selected, 'config')))) {
      selected = options.userDataDir
    }
    const store = new ConfigStore(options, selected)
    if (preferred.warning) store.warnings.push(preferred.warning)
    if (selected !== preferred.root) {
      store.warnings.push(
        `程序目录不可写，配置已回退到：${selected}。如需便携数据，请将程序移动到可写目录。`
      )
    }
    await store.load()
    return store
  }

  private static async resolveDataRoot(
    options: ConfigStoreOptions
  ): Promise<{ root: string; warning?: string }> {
    if (options.dataRootOverride?.trim()) {
      return { root: path.resolve(options.dataRootOverride.trim()) }
    }
    const pointerPath = path.join(options.programDir, DATA_DIR_POINTER)
    try {
      const pointed = (await readFile(pointerPath, 'utf8')).trim()
      if (pointed) {
        const resolved = path.resolve(pointed)
        const info = await stat(resolved).catch(() => null)
        if (info?.isDirectory()) return { root: resolved }
      }
    } catch {
      // 没有引导文件时使用程序目录。
    }
    return { root: options.programDir }
  }

  private async load(): Promise<void> {
    await ensureDirectory(this.configDir)
    const raw = await readTextIfExists(this.configPath)
    if (raw === null) {
      this.config = createDefaultConfig()
      await this.save()
      return
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      this.config = sanitizeConfig(parsed)
      const legacyAppearance =
        parsed.appearance && typeof parsed.appearance === 'object'
          ? (parsed.appearance as Record<string, unknown>)
          : {}
      if (
        parsed.schemaVersion !== 2 ||
        'theme' in legacyAppearance ||
        'mood' in legacyAppearance
      ) {
        await this.save()
      }
    } catch {
      const backup = `${this.configPath}.corrupt-${Date.now()}`
      await rename(this.configPath, backup).catch(() => undefined)
      this.warnings.push(`配置文件损坏，已备份为 ${backup} 并恢复默认配置。`)
      this.config = createDefaultConfig()
      await this.save()
    }
  }

  get(): AppConfig {
    return structuredClone(this.config)
  }

  async save(): Promise<void> {
    await writeTextAtomic(this.configPath, `${JSON.stringify(this.config, null, 2)}\n`)
  }

  async update(mutator: (config: AppConfig) => void): Promise<AppConfig> {
    const next = this.get()
    mutator(next)
    this.config = sanitizeConfig(next)
    await this.save()
    return this.get()
  }

  async setDataRoot(newRoot: string): Promise<string> {
    if (this.dataRootOverride) {
      throw new Error('当前通过测试环境变量指定了数据目录，无法在界面中修改。')
    }
    const target = path.resolve(newRoot)
    await ensureDirectory(target)
    if (!(await pathIsWritable(target))) throw new Error('目标目录不可写。')
    if (target === path.resolve(this.programDir)) {
      const message = await this.resetDataRoot()
      return message
    }
    const targetConfigDir = path.join(target, 'config')
    await ensureDirectory(targetConfigDir)
    for (const name of ['config.json', 'history.json']) {
      const source = path.join(this.configDir, name)
      const exists = await stat(source).then(() => true).catch(() => false)
      if (exists) await copyFile(source, path.join(targetConfigDir, name))
    }
    await writeTextAtomic(path.join(this.programDir, DATA_DIR_POINTER), target)
    return `数据目录已设置为：\n${target}\n\n重启程序后生效。`
  }

  async resetDataRoot(): Promise<string> {
    if (this.dataRootOverride) {
      throw new Error('当前通过测试环境变量指定了数据目录，无法在界面中修改。')
    }
    const defaultConfigDir = path.join(this.programDir, 'config')
    await ensureDirectory(defaultConfigDir)
    if (path.resolve(this.dataRoot) !== path.resolve(this.programDir)) {
      for (const name of ['config.json', 'history.json']) {
        const source = path.join(this.configDir, name)
        const exists = await stat(source).then(() => true).catch(() => false)
        if (exists) await copyFile(source, path.join(defaultConfigDir, name))
      }
    }
    await rm(path.join(this.programDir, DATA_DIR_POINTER), { force: true })
    return '已恢复为程序目录，配置与历史记录已迁回，重启后生效。'
  }

  settingsView(backgroundImageUrl: string): AppSettingsView {
    const config = this.get()
    return {
      api: {
        baseUrl: config.api.baseUrl,
        timeoutSeconds: config.api.timeoutSeconds,
        hasApiKey: Boolean(config.api.apiKey)
      },
      qr: { ...config.qr },
      historyLimit: config.historyLimit,
      appearance: structuredClone(config.appearance),
      output: { ...config.output },
      dataRoot: this.dataRoot,
      backgroundImageUrl,
      backgroundImageName: config.appearance.backgroundImage
        ? path.basename(config.appearance.backgroundImage)
        : ''
    }
  }

  async backupCorruptCopy(): Promise<string> {
    const backup = path.join(this.configDir, `config-backup-${randomUUID()}.json`)
    await copyFile(this.configPath, backup)
    return backup
  }
}

