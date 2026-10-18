import { useEffect, useState } from 'react'
import type { PaletteName } from '../../../shared/types'
import { PALETTE_DEFINITIONS } from './appearance'

function createBackdrop(palette: PaletteName): HTMLCanvasElement {
  const width = Math.max(720, window.innerWidth)
  const height = Math.max(520, window.innerHeight)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return canvas

  const { swatches } = PALETTE_DEFINITIONS[palette]
  const base = context.createLinearGradient(0, 0, width, height)
  base.addColorStop(0, swatches[0])
  base.addColorStop(0.52, swatches[1])
  base.addColorStop(1, swatches[2])
  context.fillStyle = base
  context.fillRect(0, 0, width, height)

  const glowA = context.createRadialGradient(
    width * 0.18,
    height * 0.12,
    0,
    width * 0.18,
    height * 0.12,
    width * 0.55
  )
  glowA.addColorStop(0, 'rgb(255 255 255 / 78%)')
  glowA.addColorStop(0.48, 'rgb(255 255 255 / 30%)')
  glowA.addColorStop(1, 'rgb(255 255 255 / 0%)')
  context.fillStyle = glowA
  context.fillRect(0, 0, width, height)

  const glowB = context.createRadialGradient(
    width * 0.82,
    height * 0.74,
    0,
    width * 0.82,
    height * 0.74,
    width * 0.48
  )
  glowB.addColorStop(0, 'rgb(255 255 255 / 42%)')
  glowB.addColorStop(1, 'rgb(255 255 255 / 0%)')
  context.fillStyle = glowB
  context.fillRect(0, 0, width, height)
  return canvas
}

export function usePaletteBackdrop(palette: PaletteName): HTMLCanvasElement | null {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const update = (): void => setCanvas(createBackdrop(palette))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [palette])

  return canvas
}

