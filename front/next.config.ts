import type { NextConfig } from 'next'

const apiTarget = (process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000').replace(
  /\/+$/,
  '',
)

const nextConfig: NextConfig = {
  // 允许用 127.0.0.1 访问开发服务器（Next 默认只信任 localhost）。
  allowedDevOrigins: ['127.0.0.1'],
  devIndicators: false,
  // 关闭 Next 自身的响应压缩：压缩会缓冲 SSE，导致 /chat/stream 失去逐字输出。
  // 需要压缩时交给前面的 nginx / Caddy 等反向代理处理。
  compress: false,
  // 浏览器统一请求当前站点下的 /api/v1，由 Next 代理到 FastAPI，
  // 这样登录 Cookie 是同源 Cookie，不受 localhost/127.0.0.1 跨站限制。
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiTarget}/api/v1/:path*`,
      },
    ]
  },
}

export default nextConfig
