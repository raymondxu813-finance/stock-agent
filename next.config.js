/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 仅在生产构建（Docker）时启用 standalone 模式
  // 本地开发不需要 standalone（减少 next dev 启动时间）
  ...(process.env.BUILD_STANDALONE === 'true' ? { output: 'standalone' } : {}),
  experimental: {
    serverComponentsExternalPackages: ['openai', '@prisma/client', '@prisma/adapter-pg', 'pg', 'pino', 'pino-pretty', 'ioredis'],
  },
}

module.exports = nextConfig
