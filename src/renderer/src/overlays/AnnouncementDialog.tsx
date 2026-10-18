import type { AppearanceSettings } from '../../../shared/types'
import {
  PLASMA_UI_WEBSITE_URL,
  PROJECT_LATEST_RELEASE_URL,
  PROJECT_REPOSITORY_URL,
  PROJECT_WEBSITE_URL
} from '../../../shared/constants'
import { MarkdownView } from '../components/MarkdownView'
import { ModalShell } from '../components/ModalShell'

interface AnnouncementDialogProps {
  appVersion: string
  appearance: AppearanceSettings
  content: string
  editable: boolean
  onClose: () => void
  onOpenFile?: () => void
}

export function AnnouncementDialog({
  appVersion,
  appearance,
  content,
  editable,
  onClose,
  onOpenFile
}: AnnouncementDialogProps): React.JSX.Element {
  const normalizedContent = content.replace(/^#\s+开发公告\s*$/m, '').trimStart()
  return (
    <ModalShell
      appearance={appearance}
      title="开发公告"
      eyebrow="版本与更新"
      onClose={onClose}
    >
      <div className="announcement-hero">
        <div className="announcement-version">
          <span>当前版本</span>
          <strong>v{appVersion}</strong>
        </div>
        <div>
          <span className="section-kicker">更新与项目信息</span>
          <h3>轻盈、清晰的二维码工作台</h3>
          <p>项目现已正式开源，并支持在设置中检查 GitHub 最新版本。</p>
        </div>
      </div>
      <div className="modal-scroll announcement-scroll">
        <MarkdownView content={normalizedContent} />
        <section className="announcement-project">
          <strong>关于本项目</strong>
          <p>
            易码 EzQR-Tools 是来自 CDUT 的学生项目，使用 Electron、React 与 Plasma UI 构建。
            二维码解读和生成由草料开放接口提供，本地配置与历史数据保存在程序目录。
          </p>
        </section>
      </div>
      <footer className="modal-footer announcement-footer">
        <div className="announcement-links">
          <button
            type="button"
            className="secondary-button"
            onClick={() => void window.qrTool.openExternal(PROJECT_REPOSITORY_URL)}
          >
            GitHub 仓库
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void window.qrTool.openExternal(PROJECT_LATEST_RELEASE_URL)}
          >
            最新发布
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!PROJECT_WEBSITE_URL}
            title={PROJECT_WEBSITE_URL ? '打开项目官网' : '项目官网即将上线'}
            onClick={() =>
              PROJECT_WEBSITE_URL &&
              void window.qrTool.openExternal(PROJECT_WEBSITE_URL)
            }
          >
            {PROJECT_WEBSITE_URL ? '项目官网' : '项目官网（即将上线）'}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void window.qrTool.openExternal(PLASMA_UI_WEBSITE_URL)}
          >
            Plasma UI 项目
          </button>
        </div>
        <div className="announcement-actions">
          {editable && onOpenFile && (
            <button type="button" className="text-button" onClick={onOpenFile}>
              打开公告文件
            </button>
          )}
          <button type="button" className="primary-button" onClick={onClose}>
            关闭
          </button>
        </div>
      </footer>
    </ModalShell>
  )
}

