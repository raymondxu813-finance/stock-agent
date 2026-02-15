// /app/api/user/preferences/route.ts

/**
 * 用户偏好设置 API
 *
 * GET  /api/user/preferences  — 获取当前用户的偏好（如选中的专家团）
 * PUT  /api/user/preferences  — 更新当前用户的偏好
 *
 * 存储策略（与 SessionStore 一致）：
 * - 数据库可用时：读写 User.preferencesJson 字段
 * - 数据库不可用时：读写内存 Map（本地开发兜底）
 *
 * 通过 middleware 注入的 x-user-id 请求头识别当前用户。
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/db';

/** 偏好数据结构 */
interface UserPreferences {
  selectedAgentIds?: string[];
}

/**
 * 内存兜底存储（数据库不可用时使用，与 SessionStore 的 MemorySessionStore 模式一致）
 * key: userId, value: UserPreferences
 */
const memoryPreferences = new Map<string, UserPreferences>();

/** 尝试从数据库读取偏好，失败则返回 null */
async function getFromDB(userId: string): Promise<UserPreferences | null> {
  const prisma = getPrismaClient();
  if (!prisma) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferencesJson: true },
    });

    if (!user) return null;

    if (user.preferencesJson) {
      try {
        return JSON.parse(user.preferencesJson) as UserPreferences;
      } catch {
        return {};
      }
    }
    return {};
  } catch {
    return null;
  }
}

/** 尝试保存偏好到数据库，失败则返回 false */
async function saveToDB(userId: string, preferences: UserPreferences): Promise<boolean> {
  const prisma = getPrismaClient();
  if (!prisma) return false;

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { preferencesJson: JSON.stringify(preferences) },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取用户偏好
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 优先从数据库读取
    const dbPreferences = await getFromDB(userId);
    if (dbPreferences !== null) {
      // DB 可用，同步到内存
      memoryPreferences.set(userId, dbPreferences);
      return NextResponse.json({ preferences: dbPreferences });
    }

    // DB 不可用，从内存读取
    const memPreferences = memoryPreferences.get(userId) || {};
    return NextResponse.json({ preferences: memPreferences });
  } catch (error) {
    console.error('[API /api/user/preferences] GET error:', error);
    return NextResponse.json(
      { error: '获取偏好失败' },
      { status: 500 }
    );
  }
}

/**
 * 更新用户偏好
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { preferences } = body as { preferences: UserPreferences };

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { error: '无效的偏好数据' },
        { status: 400 }
      );
    }

    // 验证 selectedAgentIds 格式
    if (preferences.selectedAgentIds !== undefined) {
      if (!Array.isArray(preferences.selectedAgentIds) ||
          !preferences.selectedAgentIds.every(id => typeof id === 'string')) {
        return NextResponse.json(
          { error: 'selectedAgentIds 必须是字符串数组' },
          { status: 400 }
        );
      }
    }

    // 读取现有偏好（优先 DB，其次内存）
    const existing = (await getFromDB(userId)) ?? memoryPreferences.get(userId) ?? {};
    const merged = { ...existing, ...preferences };

    // 写入内存（无论 DB 是否可用都写）
    memoryPreferences.set(userId, merged);

    // 尝试写入 DB（异步，不阻塞响应）
    saveToDB(userId, merged).catch(() => {});

    return NextResponse.json({ success: true, preferences: merged });
  } catch (error) {
    console.error('[API /api/user/preferences] PUT error:', error);
    return NextResponse.json(
      { error: '更新偏好失败' },
      { status: 500 }
    );
  }
}
