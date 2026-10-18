import type { AppErrorPayload } from '../../shared/types'

export class AppError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }

  toPayload(): AppErrorPayload {
    return { code: this.code, message: this.message }
  }
}

export function messageFromError(error: unknown): string {
  if (error instanceof AppError) return error.message
  if (error instanceof Error && error.message) return error.message
  return '发生未预期的错误'
}

