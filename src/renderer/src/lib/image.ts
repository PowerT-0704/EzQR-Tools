export function imageLoads(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(true)
    image.onerror = () => resolve(false)
    image.src = url
  })
}

export function createOperationId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return '发生未预期的错误'
}

