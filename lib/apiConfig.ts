// /lib/apiConfig.ts

/**
 * API 请求地址配置
 *
 * 本地开发：不设 NEXT_PUBLIC_API_BASE_URL -> 返回相对路径（同源 localhost:3000）
 * 生产 Vercel：设为 AWS ALB 域名 -> 返回完整 URL（跨域访问后端）
 *
 * 使用方式：
 *   import { getApiUrl } from '@/lib/apiConfig';
 *   fetch(getApiUrl('/api/sessions'), { method: 'POST', ... });
 */

/**
 * API 基础地址
 * - 客户端：从 NEXT_PUBLIC_API_BASE_URL 读取（Vercel 构建时内联）
 * - 未设置时：空字符串（相对路径，同源请求）
 */
const API_BASE_URL: string =
  (typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_BASE_URL
    : '') || '';

/**
 * 获取完整的 API 请求地址
 *
 * @param path API 路径，如 '/api/sessions'
 * @returns 完整地址，如 'https://api.example.com/api/sessions' 或 '/api/sessions'
 */
export function getApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

/**
 * 判断一个 URL 是否是本应用的 API 请求
 * 同时匹配相对路径 '/api/...' 和绝对路径 'https://api.example.com/api/...'
 */
export function isApiUrl(url: string): boolean {
  if (url.startsWith('/api/')) return true;
  if (API_BASE_URL && url.startsWith(`${API_BASE_URL}/api/`)) return true;
  return false;
}

/**
 * 判断一个 URL 是否是认证相关的 API（不需要携带 JWT）
 */
export function isAuthUrl(url: string): boolean {
  if (url.startsWith('/api/auth/')) return true;
  if (API_BASE_URL && url.startsWith(`${API_BASE_URL}/api/auth/`)) return true;
  return false;
}

export { API_BASE_URL };
