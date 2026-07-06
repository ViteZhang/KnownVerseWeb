// 网页端阅读偏好（字号 / 栏宽 / 行距）。随账号存 app_users.web_prefs（可空 jsonb）。
// 只影响网页端阅读页正文；跨设备随账号同步（与产品「双端同源」一致）。
// RLS 已在 app_users 上按自有行约束，无需新策略。
import type { CSSProperties } from 'react';

import { getSupabase } from '@/lib/supabase/client';

export type ReadingPrefs = {
  fontSize: number; // 正文字号 px
  width: number; // 栏宽 px
  lineHeight: number; // 行距
};

// 三档可选值（对照原型阅读偏好面板）。
export const FONT_SIZES = [15, 16.5, 18.5] as const;
export const WIDTHS = [580, 680, 820] as const;
export const LINE_HEIGHTS = [1.75, 1.95, 2.2] as const;

export const DEFAULT_PREFS: ReadingPrefs = {
  fontSize: 16.5,
  width: 680,
  lineHeight: 1.95,
};

const ONE_OF = <T extends number>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

/** 把任意对象规整成合法 ReadingPrefs（非法值回退默认档）。 */
export function normalizePrefs(raw: unknown): ReadingPrefs {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    fontSize: ONE_OF(r.fontSize, FONT_SIZES, DEFAULT_PREFS.fontSize),
    width: ONE_OF(r.width, WIDTHS, DEFAULT_PREFS.width),
    lineHeight: ONE_OF(r.lineHeight, LINE_HEIGHTS, DEFAULT_PREFS.lineHeight),
  };
}

/** 读当前用户的阅读偏好（无记录 / 未登录 / 出错都回退默认，不报错）。 */
export async function fetchReadingPrefs(): Promise<ReadingPrefs> {
  try {
    const supabase = getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return DEFAULT_PREFS;
    const { data, error } = await supabase
      .from('app_users')
      .select('web_prefs')
      .eq('id', session.user.id)
      .maybeSingle();
    if (error || !data) return DEFAULT_PREFS;
    return normalizePrefs((data as { web_prefs?: unknown }).web_prefs);
  } catch {
    return DEFAULT_PREFS;
  }
}

/** 保存阅读偏好。失败静默（偏好是增强项，不阻塞阅读）。 */
export async function saveReadingPrefs(
  prefs: ReadingPrefs,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const supabase = getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return { ok: false, error: '未登录' };
    const { error } = await supabase
      .from('app_users')
      .update({ web_prefs: prefs })
      .eq('id', session.user.id);
    return { ok: !error, error: error?.message ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '保存失败' };
  }
}

/** 阅读偏好 → 作用于 .read-inner 的内联 CSS 变量（.para 用 var 读取）。 */
export function prefsToStyle(p: ReadingPrefs): CSSProperties {
  return {
    maxWidth: p.width,
    '--rd-font': `${p.fontSize}px`,
    '--rd-lh': `${p.lineHeight}`,
  } as CSSProperties;
}
