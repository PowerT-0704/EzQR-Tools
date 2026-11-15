import { useRef, useState } from 'react'
import type { ConversionMode, ConversionResult, ConversionSource } from '../../../shared/types'
import type { UiStatus } from '../types'
import { createOperationId, errorMessage } from './image'

export function useImageConversion() {
  const inFlight = useRef(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<UiStatus>({ kind: 'idle', message: '等待选择 PNG…' })
  const [source, setSource] = useState<ConversionSource | null>(null)
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [savedPath, setSavedPath] = useState('')

  async function runTask(message: string, task: () => Promise<void>): Promise<void> {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setStatus({ kind: 'busy', message })
    try {
      await task()
    } catch (error) {
      setStatus({ kind: 'error', message: errorMessage(error) })
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  async function select(path?: string): Promise<void> {
    await runTask('正在导入图片…', async () => {
      const selection = path === undefined
        ? await window.qrTool.chooseConversionImage()
        : await window.qrTool.prepareConversionImage(path)
      if (!selection) {
        setStatus(status)
        return
      }
      setSource(selection)
      setResult(null)
      setSavedPath('')
      setStatus({ kind: 'idle', message: '请选择转换方式' })
    })
  }

  async function convert(mode: ConversionMode): Promise<void> {
    if (!source) return
    const sourceId = mode === 'trace-transparent' && result?.format === 'transparent-png'
      ? result.resultId
      : source.sourceId
    await runTask('正在本地转换 PNG…', async () => {
      setResult(await window.qrTool.convertImage({
        operationId: createOperationId('convert'),
        sourceId,
        mode
      }))
      setSavedPath('')
      setStatus({ kind: 'success', message: '转换完成，可另存' })
    })
  }

  async function save(): Promise<void> {
    if (!result) return
    await runTask('正在保存转换结果…', async () => {
      const saved = await window.qrTool.saveQr({
        operationId: createOperationId('save-conversion'),
        kind: 'converted',
        resultId: result.resultId
      })
      if (!saved) {
        setStatus(status)
        return
      }
      setSavedPath(saved.savedPath)
      setStatus({ kind: 'success', message: '转换结果已保存' })
    })
  }

  return { busy, status, source, result, savedPath, select, convert, save }
}
