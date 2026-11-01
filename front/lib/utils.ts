/** 合并 truthy 的 className。 */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

/** 格式化检索分数。 */
export function formatScore(score?: number | null, digits = 2): string {
  return typeof score === 'number' ? score.toFixed(digits) : '—'
}

/** 格式化文件大小。 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** 提取用户可读的错误信息。 */
export function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return '发生未知错误'
}
