/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 增加 API 路由的超时时间（默认是 10 秒，对于多 Agent 讨论可能需要更长时间）
  // 注意：这个配置在 Vercel 等平台上可能无效，需要在平台配置中设置
  experimental: {
    // 增加服务器端超时时间（单位：秒）
    serverComponentsExternalPackages: ['openai'],
  },
}

module.exports = nextConfig
