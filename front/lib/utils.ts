export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function formatScore(score?: number | null): string {
  return typeof score === 'number' ? score.toFixed(2) : '—'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return '发生未知错误'
}
