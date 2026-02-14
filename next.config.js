/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Docker 部署使用 standalone 输出模式，减小镜像体积
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['openai', '@prisma/client', '@prisma/adapter-pg', 'pg', 'pino', 'pino-pretty'],
  },
}

module.exports = nextConfig
