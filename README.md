<div align="center">

<img src="docs/images/ezqr-brand.png" width="108" alt="易码 EzQR-Tools 品牌图标" />

# 易码 EzQR-Tools

**二维码解析与生成，简单一点。**

一款面向 Windows 的本地优先二维码工作台。拖入图片即可解析并重构，输入文字即可生成高清 PNG；日常生成、解析、保存和历史记录均可离线完成，无需注册或配置 API Key。

![版本](https://img.shields.io/badge/version-7.2.0-526edb?style=flat-square)
![平台](https://img.shields.io/badge/platform-Windows%2010%2F11-5b7cff?style=flat-square)
![Electron](https://img.shields.io/badge/Electron-44-2f6f8f?style=flat-square)
![Plasma UI](https://img.shields.io/badge/UI-Plasma%20Liquid%20Glass-7c66d9?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-2b9b73?style=flat-square)
[![Release](https://img.shields.io/github/v/release/PowerT-0704/EzQR-Tools?style=flat-square)](https://github.com/PowerT-0704/EzQR-Tools/releases/latest)
[![GitHub](https://img.shields.io/badge/GitHub-PowerT--0704-24292f?style=flat-square&logo=github)](https://github.com/PowerT-0704/EzQR-Tools)

<sub>CDUT 学生项目 · 非官方工具 · Windows x64</sub>

</div>

<p align="center">
  <img src="docs/images/ezqr-main.png" width="960" alt="易码 EzQR-Tools 主界面" />
</p>

<p align="center"><sub>浅色液态玻璃工作台：左侧切换工作区，右侧固定预览，高频操作在一屏内完成。</sub></p>

## 项目介绍

易码 EzQR-Tools 希望把常见的二维码处理放在一个清晰的桌面工作台里：读取已有二维码中的内容、将识别结果重新生成为高清图片，或把文字、链接和文档中的文本做成二维码。它适合日常资料整理、二维码内容核对，以及需要在断网环境中完成的本地处理。

项目使用 Electron、React 和 TypeScript 构建，保留浅色液态玻璃界面，同时把二维码编码与解码放在本机完成。草料接口作为可选在线处理方式保留，由用户明确切换后才使用。当前提供 Windows x64 安装器，源码开放，欢迎通过 Issues 反馈可复现的问题。

## ✨ 为什么是 EzQR

| | 能做什么 |
| --- | --- |
| 🖼️ 图片重构 | 断网拖入二维码图片，在本机读取内容并重新生成高清 PNG，原图与结果可随时切换预览 |
| ⌨️ 本地生成 | 输入文字、链接或多行内容，断网也可生成二维码并下载，支持尺寸、纠错与边框设置 |
| 🗂️ 本地文档 | 支持 TXT、Markdown、JSON、Word、ODT、RTF 等常见文本格式 |
| 🕘 操作记录 | 生成与重构记录统一保存在历史弹窗，支持回填和打开文件 |
| 🪟 轻盈外观 | 基于 Plasma UI 的浅色液态玻璃界面，提供晨雾蓝、樱花粉、薄荷青三种氛围 |
| 🎛️ 材质调节 | 模糊、折射、色散、高光、磨砂和动效参数实时生效 |
| 🔄 更新提示 | 启动时静默检查 GitHub Release，在软件设置中提示可用新版本 |
| 🔒 本地优先 | 默认本地解析与生成，无需 API Key；在线功能由主进程处理 |

## 🖥️ 界面一览

<p align="center">
  <img src="docs/images/ezqr-workflow.png" width="720" alt="二维码重构完成后的预览工作台" />
</p>

<p align="center"><sub>图片重构工作区：解析、保存位置和二维码预览保持在同一视觉层级。</sub></p>

| 设置 | 历史记录 |
| --- | --- |
| ![设置界面](docs/images/ezqr-settings.png) | ![历史记录](docs/images/ezqr-history.png) |

<p align="center">
  <img src="docs/images/ezqr-local-settings.png" width="720" alt="本地处理引擎、二维码尺寸、纠错级别和边框设置" />
</p>

<p align="center"><sub>v7.2 使用统一处理引擎；默认本地解析与生成，图片和文本均不上传。</sub></p>

<p align="center">
  <img src="docs/images/ezqr-update.png" width="720" alt="软件设置中的 GitHub 更新检查" />
</p>

<p align="center"><sub>软件设置会自动检查 GitHub Releases，并显示当前版本与可用更新。</sub></p>

## 🚀 下载与安装

**[下载易码 EzQR-Tools v7.2.0](https://github.com/PowerT-0704/EzQR-Tools/releases/tag/v7.2.0)** · Windows 10/11 x64

| 文件 | 下载 |
| --- | --- |
| Windows x64 安装器（约 109.64 MiB） | [EzQR-Tools-7.2.0-x64-Setup.exe](https://github.com/PowerT-0704/EzQR-Tools/releases/download/v7.2.0/EzQR-Tools-7.2.0-x64-Setup.exe) |
| SHA-256 校验文件 | [SHA256SUMS-7.2.0.txt](https://github.com/PowerT-0704/EzQR-Tools/releases/download/v7.2.0/SHA256SUMS-7.2.0.txt) |

详细变更见 [发布说明](docs/releases/v7.2.0.md)，测试范围与已知限制见 [交付与验收报告](docs/releases/v7.2.0-validation.md)。安装器未进行代码签名，Windows 可能显示 SmartScreen 提示。

### 安装与第一次使用

1. 下载上面的安装器和校验文件，按下方步骤核对 SHA-256。
2. 运行安装器，选择安装目录和需要的快捷方式。
3. 打开“软件设置 → 接口与保存”，确认“处理引擎”为“本地处理（离线）”。新安装默认选择本地，无需填写接口密钥。
4. 在“图片重构”中选择或拖入图片，成功后自动保存 PNG；在“文本生成”中输入内容，生成后点击“下载二维码”选择保存位置。
5. 点击“历史记录”查看处理内容与保存路径。断网时以上流程仍可使用；GitHub 更新检查失败不会阻塞处理。

### 校验下载文件

将两个文件放在同一文件夹，在该文件夹打开 PowerShell：

```powershell
$expectedHash = ((Get-Content -LiteralPath './SHA256SUMS-7.2.0.txt' -Raw).Trim() -split '\s+')[0]
$actualHash = (Get-FileHash -LiteralPath './EzQR-Tools-7.2.0-x64-Setup.exe' -Algorithm SHA256).Hash
$actualHash -eq $expectedHash  # 应输出 True
```

v7.2.0 安装器 SHA-256：

```text
BFC8D06D41CA41B580A821230E0CC0B75448BB4C80DD20F4C1F2907D14B3B986
```

若不匹配，请重新下载并核对。SHA-256 用于验证文件与发布附件一致，不代替代码签名。

### 从旧版本升级

- 先在“软件设置 → 数据与关于”打开当前数据目录，退出程序后备份其中的 `config` 文件夹；使用自定义目录的用户应备份实际位置。
- 运行新安装器并选择原安装目录。v7.2 保留 schemaVersion 2，兼容已有配置、历史和保存设置，无需手动编辑配置文件。
- 旧配置中的有效引擎选择会保留：此前选了“草料在线”的用户，升级后需要手动切回“本地处理（离线）”才能完整离线使用。
- 启动后核对历史和保存目录。卸载或迁移前同样应备份实际数据目录；安装/卸载向导尚未纳入自动化验收。

### 从源码运行

1. **准备环境**：安装 Node.js 24 或更高版本。
2. **安装依赖并启动**：在项目目录执行 `npm ci`，然后运行 `npm run dev`。
3. **开始处理**：把二维码图片拖进窗口，或切换到“文本生成”输入内容。

```powershell
npm ci
npm run dev
```

如果当前 npm 策略阻止 Electron 安装脚本，可在项目目录补跑：

```powershell
npx install-electron --no
```

## 🧭 当前能力边界

- 文本生成默认使用本地编码器，无需联网或接口密钥；重构后的重新编码也默认在本机完成。
- 图片默认用随应用打包的 `zxing-wasm@3.1.6/reader` 本地解析，WASM 不从 CDN 下载。PNG、JPG/JPEG、BMP、GIF、WebP 由 Chromium 转换为白底 PNG，动画取首帧。
- “软件设置 → 接口与保存 → 处理引擎”统一控制解析与生成；只有明确选择草料在线时才上传原始图片与生成内容。本地失败不回退在线。有效的旧引擎选择会保留，缺少引擎字段则默认本地。
- 二维码源图最多 32 MiB、单边 8192 像素、总像素 16777216，规范化 PNG 最多 64 MiB；超限请裁剪或缩小，不静默缩放。这些限制不影响背景图片选择。
- 多码按图片位置从上到下、从左到右排序，重构首个并提示总数。失败可重试同一图片，失败任务不新增成功历史。
- 默认输出 1024×1024 PNG、M 纠错、2 模块边框；支持 128–4096 像素、L/M/Q/H 和 0–16 模块边框。边框为 0 时扫描器可能需要图片外的白色留白。
- 已移除旧的 900 字警告与 2000 字导入限制；950 个常见汉字使用 L 纠错可生成。容量取决于内容编码与纠错级别，不能无限增加；不足时会提示手动调整。
- 生成保留首尾空白和换行。文本导入仍限制 5 MiB 文件、5 万字符，防止意外导入过大文档。
- 启动不再自动检测草料生成接口；手动接口检测和 GitHub 静默更新检查仍会联网。
- 应用内更新检查只提示新版本并打开 GitHub Release，不自动下载或安装。
- 项目官网入口保留为“即将上线”；项目源码、问题反馈和版本发布统一使用 GitHub。

## 使用说明与常见问题

### 图片与保存

支持 PNG、JPG/JPEG、BMP、GIF、WebP。动画图片只读取首帧，透明区域转为白底供解析，原图预览保持原样。检测到多个二维码时，按位置从上到下、从左到右排列，界面提示数量并重构第一个；如需处理其他码，请先裁剪到目标区域。

重构图片默认保存在原图目录，命名为 `原文件名_rebuild.png`；同名结果可能被替换。再次导入文件名以 `_rebuild` 结尾的图片时，会使用 `_rebuild_1.png` 等可用编号。“软件设置 → 接口与保存 → 二维码保存模式”可改为自定义目录。文本生成的下载通过保存对话框选择文件名与位置。

### 纠错、尺寸和文本容量有什么关系？

- 纠错从 L、M、Q 到 H 逐渐增强，但可容纳的文本会减少。要放入更多内容，应在可接受的识别容错范围内手动降低纠错，而不是提高纠错。
- 增大输出像素可以让密集二维码更清晰，不能提高单个标准二维码的文本容量；增加边框也不会扩容。
- 已验证 950 个常见汉字使用 L 纠错可以生成；这不代表所有 950 字混合内容或默认 M 纠错都能成功。中文、emoji、ASCII 和数字占用的编码容量不同。
- 约 2000 个常见汉字无法直接装入本版本的单个标准二维码。若内容过长，需要缩短或拆分；也可自行准备网页链接，再让本工具生成链接二维码。本工具不提供网页托管或短链接服务。

### 导入文档需要安装 Word 吗？

TXT、Markdown、JSON 等文本及 DOCX/DOCM、ODT、RTF 在本机提取文字；旧 `.doc` 格式通过本机 Word 读取，需要安装 Word，失败时建议另存为 DOCX 或 TXT。导入只提取文本，不保留文档排版，换行统一为 LF；文件最多 5 MiB，导入后的界面内容最多 5 万字符，实际二维码仍受编码容量限制。

### 解析或保存失败怎么办？

- 未识别到二维码：尝试保留完整定位图案和四周留白，裁剪无关区域，使用更清晰的图片。
- 图片损坏或超限：先确认能正常打开；超出尺寸/文件限制时自行裁剪或缩小，应用不会静默降低分辨率。
- 本地解析组件加载失败：点击“重试此图片”；持续失败可重新安装。本地模式不会从 CDN 下载组件，也不会自动上传图片。
- 编码容量不足：缩短内容，或手动选择较低纠错；不能靠增大像素解决容量超限。
- 保存失败：检查目录权限，在设置中选择可写的自定义目录后重试。若图片已经保存而历史记录写入失败，文件会保留，任务不会新增成功历史。

## 🛠️ 技术架构

```text
React + TypeScript Renderer
        │
        │ typed IPC
        ▼
Electron Preload
        │
        ▼
Electron Main
├── QrCodeEngine / 本地 qrcode 编码器
├── LocalDecodeEngine / 本地 ZXing WASM 解析器
├── 草料适配器（显式选择的在线解析与生成）
├── 文件 / 图片 / 文本导入
├── 配置与历史存储
├── 输出路径策略
└── 窗口与系统能力
```

- **桌面框架**：Electron 44
- **界面**：React 19、TypeScript、Plasma UI 0.8
- **构建**：electron-vite、electron-builder
- **测试**：Vitest、Playwright Electron
- **渲染**：WebGL2 液态玻璃，WebGL2 不可用时自动回退 CSS 磨砂

## 🧑‍💻 本地开发

```powershell
npm ci
npm run dev
```

常用命令：

```powershell
npm run typecheck   # 主进程与渲染进程类型检查
npm run lint        # ESLint
npm test            # 单元测试
npm run test:e2e    # Electron 端到端测试
npm run build       # 生产构建
npm run dist:win    # Windows x64 NSIS 安装器
```

安装器输出到 `release\EzQR-Tools-7.2.0-x64-Setup.exe`，不会生成 ZIP。安装器当前未进行代码签名，Windows 可能显示 SmartScreen 提示；卸载或迁移前请备份“软件设置 → 数据与关于”显示的实际数据目录中的 `config` 文件夹。

可选的草料适配器联网冒烟测试（会上传指定图片，并调用在线生成；不代表默认本地处理流程）：

```powershell
npm run test:api -- "X:\path\to\qrcode.png"
```

品牌图标可从 `resources/logo-source.png` 重新生成：

```powershell
python scripts/generate_brand_assets.py
```

该脚本仅用于生成 PNG/ICO 资源，需要开发机安装 Pillow，不是应用运行依赖。

## 🔐 数据与安全

- 默认数据目录：程序目录下的 `config`；程序目录不可写时，会回退到 Electron 用户数据目录。请从“软件设置 → 数据与关于”查看并打开实际数据目录。
- 配置文件：`config/config.json`；历史文件：`config/history.json`。
- 接口密钥只由主进程读取，不会通过 IPC 返回给渲染界面。
- 渲染进程启用 sandbox 与 context isolation，禁用 Node integration。
- 不采集桌面，不截图，也不包含窗口后方桌面的实时折射。
- 可通过“软件设置 → 数据与关于”修改数据目录，应用会复制配置和历史，重启后生效；目录引导由程序目录下的 `data_dir.txt` 保存，无需手动编辑。

## 🗺️ 未来规划

**Local-first** 的核心流程已随 v7.2 完成：二维码生成、解析和图片重构可以离线使用。后续继续完善体验与扩展能力。

| 版本 | 目标 |
| --- | --- |
| `v7.1`（已完成） | 本地二维码编码器、离线文本生成、重构后本地编码与可选在线生成 |
| `v7.2`（已完成） | 引入本地 ZXing/WASM 解码，图片解析与重构不再依赖草料接口 |
| `v7.3` | 继续完善离线状态与在线兼容体验；统一离线开关已随 v7.2 提前完成 |
| 后续 | 批量处理、SVG/PDF、二维码样式、Logo 嵌入、自动更新与跨平台构建 |

详细拆分、技术选型和验收标准见 **[docs/ROADMAP.md](docs/ROADMAP.md)**。

## 项目背景与 CDUT 说明

**CDUT 指成都理工大学（Chengdu University of Technology）。** 易码是由 CDUT 学生开发维护的开源实践项目，围绕桌面应用、交互设计与本地二维码处理开展学习和工程实践，希望把日常遇到的小需求做成可持续改进的工具。

这里的 CDUT 用于说明学生项目背景。易码属于个人开发项目，不是学校官方产品，也与学校及草料官方无隶属关系；项目的维护、版本发布和问题反馈以本 GitHub 仓库为准。

欢迎提交复现步骤、截图或改进建议。反馈时请先移除接口密钥及不希望公开的二维码内容；错误报告可通过 [GitHub Issues](https://github.com/PowerT-0704/EzQR-Tools/issues) 提交。

## ❤️ 致谢

- [Plasma UI](https://github.com/CruxGarden/plasma-ui)：WebGL 液态玻璃组件与渲染引擎。
- [Electron](https://www.electronjs.org/)、[React](https://react.dev/) 与 TypeScript 社区。
- [qrcode](https://github.com/soldair/node-qrcode) 提供纯 JavaScript 本地二维码编码。
- [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) / ZXing-C++ 提供本地二维码解析。
- 草料开放接口提供可选在线解析与生成能力，许可见 [第三方说明](THIRD_PARTY_NOTICES.md)。
- 感谢所有参与测试、反馈问题和改进体验的同学。

## 📄 授权

本项目以 [MIT License](LICENSE) 发布。

问题反馈与功能建议请使用 [GitHub Issues](https://github.com/PowerT-0704/EzQR-Tools/issues)。

<div align="center">

<sub>易码 EzQR-Tools 是 CDUT 学生项目，与学校及草料官方无隶属关系。</sub>

</div>

