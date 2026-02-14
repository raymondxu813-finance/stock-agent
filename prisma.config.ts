// Prisma 配置
// 注意：不引用 dotenv，环境变量由运行环境（ECS/Vercel/本地 .env.local）提供
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
