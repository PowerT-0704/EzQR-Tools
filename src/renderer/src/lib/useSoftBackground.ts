import { useEffect, useState } from 'react'

function drawSoftBackground(image: HTMLImageElement): HTMLCanvasElement {
  const width = Math.max(1, window.innerWidth)
  const height = Math.max(1, window.innerHeight)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return canvas

  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  context.filter = 'saturate(0.82) brightness(1.06) blur(1px)'
  context.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  )
  context.filter = 'none'
  context.fillStyle = 'rgb(255 255 255 / 68%)'
  context.fillRect(0, 0, width, height)
  const wash = context.createLinearGradient(0, 0, width, height)
  wash.addColorStop(0, 'rgb(255 255 255 / 22%)')
  wash.addColorStop(0.55, 'rgb(244 248 255 / 10%)')
  wash.addColorStop(1, 'rgb(224 237 255 / 24%)')
  context.fillStyle = wash
  context.fillRect(0, 0, width, height)
  return canvas
}

export function useSoftBackground(url: string): HTMLCanvasElement | null {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)

  useEffect(() => {
    let active = true
    let image: HTMLImageElement | null = null

    if (!url) {
      setCanvas(null)
      return () => undefined
    }

    const render = (): void => {
      if (active && image?.complete && image.naturalWidth > 0) {
        setCanvas(drawSoftBackground(image))
      }
    }

    image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = render
    image.onerror = () => {
      if (active) setCanvas(null)
    }
    image.src = url
    window.addEventListener('resize', render)

    return () => {
      active = false
      window.removeEventListener('resize', render)
      image = null
    }
  }, [url])

  return canvas
}

