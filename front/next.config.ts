import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 允许用 127.0.0.1 访问开发服务器（Next 默认只信任 localhost）。
  allowedDevOrigins: ['127.0.0.1'],
  devIndicators: false,
}

export default nextConfig
