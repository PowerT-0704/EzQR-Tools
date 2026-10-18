export const APP_NAME = '易码 EzQR-Tools'
export const APP_AUTHOR_EMAIL = 'W3F7-1203019025@qq.com'
export const DEFAULT_BASE_URL = 'https://api.2dcode.biz/v1'
export const DEFAULT_QR_SIZE = 1024
export const DEFAULT_ERROR_CORRECTION = 'M' as const
export const DEFAULT_QR_BORDER = 2
export const DEFAULT_TIMEOUT_SECONDS = 20
export const DEFAULT_HISTORY_LIMIT = 50
export const CONTENT_LIMIT_HINT = 900
export const FILL_LIMIT = 2000
export const UI_TEXT_LIMIT = 50000
export const MAX_TEXT_FILE_BYTES = 5 * 1024 * 1024
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp'] as const
export const APP_USER_MODEL_ID = 'W3F7.EzQRTools'
export const MEDIA_SCHEME = 'qrtool-media'
export const PROJECT_WEBSITE_URL = ''
export const PROJECT_REPOSITORY_URL = 'https://github.com/PowerT-0704/EzQR-Tools'
export const PROJECT_RELEASES_URL = `${PROJECT_REPOSITORY_URL}/releases`
export const PROJECT_LATEST_RELEASE_URL = `${PROJECT_RELEASES_URL}/latest`
export const PROJECT_ISSUES_URL = `${PROJECT_REPOSITORY_URL}/issues`
export const GITHUB_LATEST_RELEASE_API_URL =
  'https://api.github.com/repos/PowerT-0704/EzQR-Tools/releases/latest'
export const UPDATE_CHECK_TIMEOUT_MS = 10_000
export const PLASMA_UI_WEBSITE_URL = 'https://cruxgarden.github.io/plasma-ui/'

export const MATERIAL_LIMITS = {
  backgroundBlur: { min: 0, max: 30, step: 1, default: 8 },
  refraction: { min: 0, max: 1.8, step: 0.05, default: 1.05 },
  dispersion: { min: 0, max: 1.4, step: 0.05, default: 0.55 },
  highlight: { min: 0, max: 1.5, step: 0.05, default: 0.8 },
  frost: { min: 0, max: 0.8, step: 0.01, default: 0.35 },
  elevation: { min: 0, max: 0.6, step: 0.01, default: 0.2 },
  viscosity: { min: 0, max: 1, step: 0.01, default: 0.5 }
} as const

