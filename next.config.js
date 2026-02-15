/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 仅在生产构建（Docker）时启用 standalone 模式
  // 本地开发不需要 standalone（减少 next dev 启动时间）
  ...(process.env.BUILD_STANDALONE === 'true' ? { output: 'standalone' } : {}),
  experimental: {
    serverComponentsExternalPackages: ['openai', '@prisma/client', '@prisma/adapter-pg', 'pg', 'pino', 'pino-pretty', 'ioredis'],
  },

  /**
   * Vercel 反向代理配置
   *
   * 当部署在 Vercel 上时，前端是 HTTPS，但后端 API 在 AWS ECS (ALB HTTP)。
   * 使用 beforeFiles rewrite 将 /api/* 请求在服务端代理到 ECS ALB，
   * 浏览器只看到同源 HTTPS 请求，避免混合内容问题。
   *
   * 需要在 Vercel 环境变量中设置：
   *   API_BACKEND_URL = http://multiagent-alb-xxx.ap-east-1.elb.amazonaws.com
   *
   * 本地开发和 Docker/ECS 部署不受影响（process.env.VERCEL 不存在）。
   */
  async rewrites() {
    const backendUrl = process.env.API_BACKEND_URL;
    // 仅在 Vercel 环境且配置了后端地址时启用代理
    if (process.env.VERCEL && backendUrl) {
      return {
        beforeFiles: [
          {
            source: '/api/:path*',
            destination: `${backendUrl}/api/:path*`,
          },
        ],
      };
    }
    return { beforeFiles: [] };
  },
}

module.exports = nextConfig
