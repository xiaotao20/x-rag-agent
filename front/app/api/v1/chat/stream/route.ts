import type { NextRequest } from 'next/server'

const apiTarget = (process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000').replace(
  /\/+$/,
  '',
)

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 直接转发 SSE 请求。
 *
 * Next 生产环境的 rewrites 代理会压缩并缓冲 text/event-stream，
 * 即使配置了 compress: false 也一样；这里改用 Route Handler 原样透传。
 */
export async function POST(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('content-length')
  headers.delete('connection')
  // 不向上游请求压缩，避免任何一层缓存整个事件流。
  headers.delete('accept-encoding')

  let upstream: Response
  try {
    upstream = await fetch(`${apiTarget}/api/v1/chat/stream`, {
      method: 'POST',
      headers,
      body: await request.arrayBuffer(),
      cache: 'no-store',
      signal: request.signal,
    })
  } catch (error) {
    return Response.json(
      { detail: `无法连接后端服务：${error instanceof Error ? error.message : error}` },
      { status: 502 },
    )
  }

  if (!upstream.body) {
    return new Response('上游没有返回响应体', { status: 502 })
  }

  const responseHeaders = new Headers()
  responseHeaders.set(
    'Content-Type',
    upstream.headers.get('content-type') ?? 'text/event-stream; charset=utf-8',
  )
  responseHeaders.set('Cache-Control', 'no-cache, no-transform')
  responseHeaders.set('X-Accel-Buffering', 'no')

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}
