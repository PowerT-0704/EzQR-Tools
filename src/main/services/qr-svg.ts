import { AppError } from './errors'

interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

const MAX_RECTANGLES = 100_000

export function renderBlackSvg(
  width: number,
  height: number,
  isBlack: (x: number, y: number) => boolean,
  displayWidth = width,
  displayHeight = height
): Buffer {
  const rectangles: Rectangle[] = []
  let previous = new Map<number, Rectangle>()

  for (let y = 0; y < height; y += 1) {
    const row = new Map<number, Rectangle>()
    let x = 0
    while (x < width) {
      if (!isBlack(x, y)) {
        x += 1
        continue
      }
      const start = x
      do {
        x += 1
      } while (x < width && isBlack(x, y))
      const length = x - start
      // Identical runs on neighboring rows share one rectangle.
      const key = start * width + length
      let rectangle = previous.get(key)
      if (rectangle) {
        rectangle.height += 1
      } else {
        if (rectangles.length >= MAX_RECTANGLES) {
          throw new AppError('SVG_TOO_COMPLEX', '黑块过多，超过 SVG 转换上限，请缩小图片或通过重构重新生成')
        }
        rectangle = { x: start, y, width: length, height: 1 }
        rectangles.push(rectangle)
      }
      row.set(key, rectangle)
    }
    previous = row
  }

  const path = rectangles.map((r) =>
    'M' + r.x + ' ' + r.y + 'h' + r.width + 'v' + r.height + 'h-' + r.width + 'z'
  ).join('')
  return Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + displayWidth + '" height="' + displayHeight +
      '" viewBox="0 0 ' + width + ' ' + height + '" shape-rendering="crispEdges">' +
      '<path fill="#000" d="' + path + '"/></svg>\n'
  )
}
