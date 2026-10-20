import { useState } from 'react'
import { Plasma } from '@cruxgarden/plasma-ui'
import {
  MATERIAL_LIMITS,
  PLASMA_UI_WEBSITE_URL,
  PROJECT_RELEASES_URL,
  PROJECT_REPOSITORY_URL,
  PROJECT_WEBSITE_URL
} from '../../../shared/constants'
import type {
  AppSettingsView,
  MaterialSettings,
  PaletteName,
  SettingsPatch,
  UpdateInfo
} from '../../../shared/types'
import { DEFAULT_MATERIAL, PALETTE_DEFINITIONS } from '../lib/appearance'
import { ModalShell } from '../components/ModalShell'
import { truncateMiddle } from '../../../shared/format'

type SettingsCategory = 'appearance' | 'material' | 'api' | 'data'

interface SettingsDialogProps {
  appVersion: string
  settings: AppSettingsView
  updateInfo: UpdateInfo | null
  updateBusy: boolean
  onClose: () => void
  onPatch: (patch: SettingsPatch) => void
  onChooseBackground: () => void
  onClearBackground: () => void
  onChooseOutput: () => void
  onChooseDataDirectory: () => void
  onResetDataDirectory: () => void
  onSetApiKey: (value: string) => Promise<void>
  onCheckForUpdates: () => void
  onToast: (message: string) => void
}

interface SliderFieldProps {
  label: string
  description: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (value: number) => void
}

const CATEGORIES: Array<{
  id: SettingsCategory
  label: string
  description: string
}> = [
  { id: 'appearance', label: '外观与背景', description: '浅色氛围和背景图片' },
  { id: 'material', label: '玻璃材质', description: '透明度、折射和光感' },
  { id: 'api', label: '接口与保存', description: '处理引擎、参数与保存' },
  { id: 'data', label: '数据与关于', description: '数据目录和版本信息' }
]

function SliderField({
  label,
  description,
  value,
  min,
  max,
  step,
  display,
  onChange
}: SliderFieldProps): React.JSX.Element {
  const progress = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  return (
    <label className="setting-slider">
      <span className="setting-slider-heading">
        <strong>{label}</strong>
        <span>{display}</span>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--range-progress': `${progress}%` } as React.CSSProperties}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
      <small>{description}</small>
    </label>
  )
}

function Segmented<T extends string>({
  value,
  items,
  onChange,
  label
}: {
  value: T
  items: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  label: string
}): React.JSX.Element {
  return (
    <div className="setting-segmented" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={value === item.value}
          className={value === item.value ? 'active' : ''}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function SettingsDialog({
  appVersion,
  settings,
  updateInfo,
  updateBusy,
  onClose,
  onPatch,
  onChooseBackground,
  onClearBackground,
  onChooseOutput,
  onChooseDataDirectory,
  onResetDataDirectory,
  onSetApiKey,
  onCheckForUpdates,
  onToast
}: SettingsDialogProps): React.JSX.Element {
  const [category, setCategory] = useState<SettingsCategory>('appearance')
  const [apiKey, setApiKey] = useState('')
  const material = settings.appearance.material
  const electronVersion = window.navigator.userAgent.match(/Electron\/([\d.]+)/)?.[1] ?? ''
  const activeCategory = Math.max(
    0,
    CATEGORIES.findIndex((item) => item.id === category)
  )
  const updateTitle = updateBusy
    ? '正在检查更新'
    : updateInfo?.status === 'available'
      ? `发现新版本 v${updateInfo.latestVersion}`
      : updateInfo?.status === 'upToDate'
        ? '已是最新版本'
        : updateInfo?.status === 'error'
          ? '暂时无法检查更新'
          : '等待检查更新'
  const updateDescription = updateBusy
    ? '正在连接 GitHub Releases，请稍候。'
    : updateInfo?.status === 'available'
      ? `当前版本 v${appVersion}，可前往 GitHub 查看更新内容并下载安装器。`
      : updateInfo?.status === 'upToDate'
        ? `当前版本 v${appVersion} 已是 GitHub 上的最新稳定版本。`
        : updateInfo?.status === 'error'
          ? updateInfo.message
          : '启动后会自动检查；也可以手动连接 GitHub 获取最新版本。'
  const publishedDate = updateInfo?.publishedAt
    ? new Date(updateInfo.publishedAt).toLocaleDateString('zh-CN')
    : ''

  const materialPatch = (key: keyof MaterialSettings, value: number): void => {
    onPatch({ appearance: { material: { [key]: value } } })
  }

  return (
    <ModalShell
      appearance={settings.appearance}
      title="软件设置"
      eyebrow="个性化与数据"
      wide
      onClose={onClose}
    >
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="设置分类">
          <span className="settings-nav-caption">设置分类</span>
          <div
            className="settings-nav-track"
            role="tablist"
            aria-orientation="vertical"
            style={{ '--active-setting': activeCategory } as React.CSSProperties}
          >
            <span className="settings-nav-thumb" aria-hidden="true" />
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                id={`settings-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={category === item.id}
                aria-controls={`settings-panel-${item.id}`}
                className={category === item.id ? 'active' : ''}
                onClick={() => setCategory(item.id)}
              >
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </button>
            ))}
          </div>
        </nav>

        <div
          className="settings-pane"
          id={`settings-panel-${category}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${category}`}
        >
          {category === 'appearance' && (
            <section className="settings-section">
              <header className="settings-section-header">
                <div>
                  <span className="section-kicker">浅色氛围</span>
                  <h3>选择界面色调</h3>
                  <p>三种低饱和背景会实时应用到主界面和弹窗。</p>
                </div>
              </header>

              <div className="palette-grid">
                {(Object.keys(PALETTE_DEFINITIONS) as PaletteName[]).map((palette) => {
                  const definition = PALETTE_DEFINITIONS[palette]
                  return (
                    <button
                      key={palette}
                      type="button"
                      className={`palette-card ${settings.appearance.palette === palette ? 'active' : ''}`}
                      onClick={() => onPatch({ appearance: { palette } })}
                    >
                      <span className="palette-swatches" aria-hidden="true">
                        {definition.swatches.map((color) => (
                          <i key={color} style={{ background: color }} />
                        ))}
                      </span>
                      <span>
                        <strong>{definition.label}</strong>
                        <small>{definition.description}</small>
                      </span>
                      <span className="palette-check">
                        {settings.appearance.palette === palette ? '已选择' : '选择'}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="setting-panel light-panel">
                <div className="setting-row">
                  <div>
                    <strong>自定义背景图片</strong>
                    <p>图片会先柔化并叠加白色遮罩，保持整体浅色对比。</p>
                  </div>
                  <div className="setting-inline-actions">
                    <button type="button" className="secondary-button" onClick={onChooseBackground}>
                      选择图片
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      disabled={!settings.backgroundImageName}
                      onClick={onClearBackground}
                    >
                      清除
                    </button>
                  </div>
                </div>
                <code className="setting-path" title={settings.backgroundImageName}>
                  {settings.backgroundImageName
                    ? truncateMiddle(settings.backgroundImageName, 72)
                    : '当前使用动态浅色氛围背景'}
                </code>
              </div>

              <div className="settings-tip-card">
                <strong>浅色界面说明</strong>
                <p>三种氛围只改变低饱和背景和强调色，白色玻璃卡片始终保持清晰分层。</p>
                <p>如果选择自定义图片，程序会先柔化并叠加白色遮罩，避免暗色图片影响文字可读性。</p>
              </div>
            </section>
          )}

          {category === 'material' && (
            <section className="settings-section">
              <header className="settings-section-header material-heading">
                <div>
                  <span className="section-kicker">实时材质</span>
                  <h3>调整液态玻璃观感</h3>
                  <p>所有调整会立即同步到主画布和右侧预览。</p>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    onPatch({ appearance: { material: DEFAULT_MATERIAL } })
                  }
                >
                  恢复材质默认值
                </button>
              </header>

              <div className="material-preview-stage">
                <Plasma
                  className="material-preview-card"
                  fuse={false}
                  lean={false}
                >
                  <span className="preview-surface-label">实时材质预览</span>
                  <strong>轻盈、清晰、保持距离</strong>
                  <p>表面之间不再融合，保留折射和柔和边缘光。</p>
                  <div className="preview-control-demo">
                    <span className="demo-pill">按钮预览</span>
                    <span className="demo-line" />
                    <span className="demo-dot" />
                  </div>
                </Plasma>
              </div>

              <div className="material-controls">
                <SliderField
                  label="背景模糊"
                  description="柔化整个浅色背景，过高的值会增加显卡开销。"
                  value={material.backgroundBlur}
                  min={MATERIAL_LIMITS.backgroundBlur.min}
                  max={MATERIAL_LIMITS.backgroundBlur.max}
                  step={MATERIAL_LIMITS.backgroundBlur.step}
                  display={`${Math.round(material.backgroundBlur)} 像素`}
                  onChange={(value) => materialPatch('backgroundBlur', value)}
                />
                <SliderField
                  label="边缘折射"
                  description="控制玻璃边缘对背后背景的弯折强度。"
                  value={material.refraction}
                  min={MATERIAL_LIMITS.refraction.min}
                  max={MATERIAL_LIMITS.refraction.max}
                  step={MATERIAL_LIMITS.refraction.step}
                  display={material.refraction.toFixed(2)}
                  onChange={(value) => materialPatch('refraction', value)}
                />
                <SliderField
                  label="彩色色散"
                  description="让边缘出现轻微彩色分离，数值过高会显得刺眼。"
                  value={material.dispersion}
                  min={MATERIAL_LIMITS.dispersion.min}
                  max={MATERIAL_LIMITS.dispersion.max}
                  step={MATERIAL_LIMITS.dispersion.step}
                  display={material.dispersion.toFixed(2)}
                  onChange={(value) => materialPatch('dispersion', value)}
                />
                <SliderField
                  label="高光强度"
                  description="控制表面随鼠标移动产生的柔和高光。"
                  value={material.highlight}
                  min={MATERIAL_LIMITS.highlight.min}
                  max={MATERIAL_LIMITS.highlight.max}
                  step={MATERIAL_LIMITS.highlight.step}
                  display={material.highlight.toFixed(2)}
                  onChange={(value) => materialPatch('highlight', value)}
                />
                <SliderField
                  label="磨砂程度"
                  description="数值越高，透过玻璃看到的背景越柔和。"
                  value={material.frost}
                  min={MATERIAL_LIMITS.frost.min}
                  max={MATERIAL_LIMITS.frost.max}
                  step={MATERIAL_LIMITS.frost.step}
                  display={`${Math.round(material.frost * 100)}%`}
                  onChange={(value) => materialPatch('frost', value)}
                />
                <SliderField
                  label="悬浮高度"
                  description="控制卡片阴影和离背景的视觉距离。"
                  value={material.elevation}
                  min={MATERIAL_LIMITS.elevation.min}
                  max={MATERIAL_LIMITS.elevation.max}
                  step={MATERIAL_LIMITS.elevation.step}
                  display={material.elevation.toFixed(2)}
                  onChange={(value) => materialPatch('elevation', value)}
                />
                <SliderField
                  label="动效阻尼"
                  description="控制按钮和表面跟随指针时的回弹速度。"
                  value={material.viscosity}
                  min={MATERIAL_LIMITS.viscosity.min}
                  max={MATERIAL_LIMITS.viscosity.max}
                  step={MATERIAL_LIMITS.viscosity.step}
                  display={`${Math.round(material.viscosity * 100)}%`}
                  onChange={(value) => materialPatch('viscosity', value)}
                />
              </div>
            </section>
          )}

          {category === 'api' && (
            <section className="settings-section">
              <header className="settings-section-header">
                <div>
                  <span className="section-kicker">连接与文件</span>
                  <h3>处理引擎、参数与保存</h3>
                  <p>文本生成、图片解析和重构，共用下方处理引擎与参数。</p>
                </div>
              </header>

              <div className="setting-panel light-panel">
                <div className="setting-row">
                  <div>
                    <strong>处理引擎</strong>
                    <p>
                      {settings.qr.engine === 'local'
                        ? '图片解析和二维码生成均在本机完成，无需 API Key。'
                        : '图片和生成内容将上传草料接口，需要联网。'}
                    </p>
                  </div>
                  <Segmented
                    label="处理引擎"
                    value={settings.qr.engine}
                    items={[
                      { value: 'local', label: '本地处理（离线）' },
                      { value: 'caoliao', label: '草料在线' }
                    ]}
                    onChange={(engine) => onPatch({ qr: { engine } })}
                  />
                </div>
                <p className="input-hint">
                  默认本地处理，图片和文本不会上传；明确选择草料在线后，才会上传原始图片和生成内容。
                </p>
              </div>

              <div className="qr-parameter-controls">
                <SliderField
                  label="二维码尺寸"
                  description="输出 PNG 的宽高像素。内容较多时需要更大尺寸。"
                  value={settings.qr.size}
                  min={128}
                  max={4096}
                  step={1}
                  display={`${settings.qr.size} × ${settings.qr.size} px`}
                  onChange={(size) => onPatch({ qr: { size } })}
                />
                <SliderField
                  label="边框"
                  description="二维码四周的空白模块数；建议保留至少 2 个模块。"
                  value={settings.qr.border}
                  min={0}
                  max={16}
                  step={1}
                  display={`${settings.qr.border} 模块`}
                  onChange={(border) => onPatch({ qr: { border } })}
                />
                <div className="setting-panel light-panel">
                  <div className="setting-row">
                    <div>
                      <strong>纠错级别</strong>
                      <p>纠错越高，可容纳的内容越少；容量不足时可手动改为 L。</p>
                    </div>
                    <Segmented
                      label="纠错级别"
                      value={settings.qr.errorCorrection}
                      items={[
                        { value: 'L', label: 'L' },
                        { value: 'M', label: 'M' },
                        { value: 'Q', label: 'Q' },
                        { value: 'H', label: 'H' }
                      ]}
                      onChange={(errorCorrection) => onPatch({ qr: { errorCorrection } })}
                    />
                  </div>
                </div>
              </div>

              <div className="setting-panel light-panel">
                <div className="setting-row">
                  <div>
                    <strong>接口密钥</strong>
                    <p>
                      {settings.api.hasApiKey ? '已配置，可重新输入覆盖。' : '未配置，当前可免密钥使用。'}
                      密钥只供在线接口使用，不会回传到界面。
                    </p>
                  </div>
                  <span className={`config-state ${settings.api.hasApiKey ? 'on' : ''}`}>
                    {settings.api.hasApiKey ? '已配置' : '未配置'}
                  </span>
                </div>
                <div className="api-key-row">
                  <input
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    placeholder={settings.api.hasApiKey ? '输入新密钥以覆盖' : '输入接口密钥（可选）'}
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                  <button
                    type="button"
                    className="primary-button"
                    onClick={async () => {
                      await onSetApiKey(apiKey)
                      setApiKey('')
                      onToast(apiKey.trim() ? '接口密钥已保存' : '接口密钥已清除')
                    }}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={async () => {
                      await onSetApiKey('')
                      setApiKey('')
                      onToast('接口密钥已清除')
                    }}
                  >
                    清除
                  </button>
                </div>
              </div>

              <div className="setting-panel light-panel">
                <div className="setting-row">
                  <div>
                    <strong>二维码保存模式</strong>
                    <p>重构图片可跟随原图保存，或统一保存到指定目录。</p>
                  </div>
                  <Segmented
                    label="二维码保存模式"
                    value={settings.output.mode}
                    items={[
                      { value: 'source', label: '跟随源文件' },
                      { value: 'custom', label: '自定义目录' }
                    ]}
                    onChange={(mode) => onPatch({ output: { mode } })}
                  />
                </div>
                <div className="setting-inline-actions path-actions">
                  <code className="setting-path" title={settings.output.directory}>
                    {settings.output.directory || '尚未选择导出目录'}
                  </code>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={settings.output.mode !== 'custom'}
                    onClick={onChooseOutput}
                  >
                    浏览
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={!settings.output.directory}
                    onClick={() => void window.qrTool.openPath(settings.output.directory)}
                  >
                    打开
                  </button>
                </div>
              </div>
            </section>
          )}

          {category === 'data' && (
            <section className="settings-section">
              <header className="settings-section-header">
                <div>
                  <span className="section-kicker">本地数据</span>
                  <h3>数据目录与版本</h3>
                  <p>配置和历史记录默认保存在程序目录。</p>
                </div>
              </header>

              <div className="setting-panel light-panel">
                <div className="setting-row">
                  <div>
                    <strong>数据文件目录</strong>
                    <p>修改目录后需要重启程序才能生效。</p>
                  </div>
                  <div className="setting-inline-actions">
                    <button type="button" className="secondary-button" onClick={onChooseDataDirectory}>
                      修改目录
                    </button>
                    <button type="button" className="secondary-button" onClick={onResetDataDirectory}>
                      恢复默认
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => void window.qrTool.openDataDirectory()}
                    >
                      打开
                    </button>
                  </div>
                </div>
                <code className="setting-path" title={settings.dataRoot}>
                  {settings.dataRoot}
                </code>
              </div>

              <div
                className={`setting-panel light-panel update-panel update-${updateInfo?.status ?? 'idle'}`}
                aria-live="polite"
              >
                <div className="setting-row">
                  <div>
                    <span className="section-kicker">软件更新</span>
                    <strong>{updateTitle}</strong>
                    <p>{updateDescription}</p>
                  </div>
                  <div className="setting-inline-actions">
                    {updateInfo?.status === 'available' && updateInfo.releaseUrl && (
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                          void window.qrTool.openExternal(updateInfo.releaseUrl!)
                        }
                      >
                        查看 GitHub Release
                      </button>
                    )}
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={updateBusy}
                      onClick={onCheckForUpdates}
                    >
                      {updateBusy ? '检查中…' : '检查更新'}
                    </button>
                  </div>
                </div>
                <div className="update-meta">
                  <span>当前版本 v{appVersion}</span>
                  {updateInfo?.latestVersion && (
                    <span>最新版本 v{updateInfo.latestVersion}</span>
                  )}
                  {publishedDate && <span>发布日期 {publishedDate}</span>}
                </div>
              </div>

              <div className="about-card">
                <img src="./logo.png" alt="" />
                <div>
                  <strong>易码 EzQR-Tools</strong>
                  <p>CDUT 学生项目 · 非官方工具</p>
                  <p>界面引擎 Plasma 0.8.0 · 运行环境 Electron {electronVersion}</p>
                  <span>当前版本 v{appVersion}</span>
                  <div className="about-links">
                    <button
                      type="button"
                      onClick={() => void window.qrTool.openExternal(PROJECT_REPOSITORY_URL)}
                    >
                      GitHub 仓库
                    </button>
                    <button
                      type="button"
                      onClick={() => void window.qrTool.openExternal(PROJECT_RELEASES_URL)}
                    >
                      最新发布
                    </button>
                    <button
                      type="button"
                      disabled={!PROJECT_WEBSITE_URL}
                      onClick={() =>
                        PROJECT_WEBSITE_URL &&
                        void window.qrTool.openExternal(PROJECT_WEBSITE_URL)
                      }
                    >
                      {PROJECT_WEBSITE_URL ? '项目官网' : '项目官网（即将上线）'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void window.qrTool.openExternal(PLASMA_UI_WEBSITE_URL)}
                    >
                      Plasma UI 项目
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <footer className="modal-footer settings-footer">
        <span>修改会即时生效并自动保存</span>
        <button type="button" className="primary-button" onClick={onClose}>
          完成
        </button>
      </footer>
    </ModalShell>
  )
}

