import { describe, expect, it } from 'vitest'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { APP_NAME, APP_USER_MODEL_ID } from '../src/shared/constants'

const root = path.resolve(import.meta.dirname, '..')

describe('EzQR-Tools branding', () => {
  it('uses the new product identity across runtime constants and package metadata', async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(root, 'package.json'), 'utf8')
    ) as { name: string; version: string; description: string }
    expect(APP_NAME).toBe('易码 EzQR-Tools')
    expect(APP_USER_MODEL_ID).toBe('W3F7.EzQRTools')
    expect(packageJson.name).toBe('ezqr-tools')
    expect(packageJson.version).toBe('7.2.0')
    expect(packageJson.description).toContain('易码 EzQR-Tools')
  })

  it('ships outlined PNG and multi-size Windows icon assets', async () => {
    const logoPath = path.join(root, 'resources', 'logo.png')
    const iconPath = path.join(root, 'resources', 'EzQR-Tools.ico')
    const rendererLogoPath = path.join(root, 'src', 'renderer', 'public', 'logo.png')
    const docsLogoPath = path.join(root, 'docs', 'images', 'ezqr-brand.png')
    await Promise.all(
      [logoPath, iconPath, rendererLogoPath, docsLogoPath].map((file) =>
        access(file)
      )
    )

    const png = await readFile(logoPath)
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(png.readUInt32BE(16)).toBe(1024)
    expect(png.readUInt32BE(20)).toBe(1024)

    const icon = await readFile(iconPath)
    expect(icon.readUInt16LE(0)).toBe(0)
    expect(icon.readUInt16LE(2)).toBe(1)
    expect(icon.readUInt16LE(4)).toBe(7)
  })

  it('contains the GitHub-ready product page and roadmap', async () => {
    const readme = await readFile(path.join(root, 'README.md'), 'utf8')
    const roadmap = await readFile(path.join(root, 'docs', 'ROADMAP.md'), 'utf8')
    const license = await readFile(path.join(root, 'LICENSE'), 'utf8')
    const screenshots = [
      'ezqr-main.png',
      'ezqr-workflow.png',
      'ezqr-settings.png',
      'ezqr-history.png',
      'ezqr-update.png'
    ]
    await Promise.all(
      screenshots.map((name) =>
        access(path.join(root, 'docs', 'images', name))
      )
    )
    expect(readme).toContain('# 易码 EzQR-Tools')
    expect(readme).toContain('CDUT 学生项目 · 非官方工具')
    expect(readme).toContain('docs/ROADMAP.md')
    expect(readme).toContain('https://github.com/PowerT-0704/EzQR-Tools/releases/latest')
    expect(readme).toContain('https://github.com/PowerT-0704/EzQR-Tools/issues')
    expect(readme).not.toContain('# QRCodeTool v')
    expect(roadmap).toContain('Local-first')
    expect(roadmap).toContain('v7.1')
    expect(roadmap).toContain('v7.2')
    expect(license).toContain('MIT License')
  })
})

