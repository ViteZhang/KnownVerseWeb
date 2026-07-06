// 用户级记忆（跨空间，关于「这个人」的稳定属性）。移植自 App src/lib/user-memory.ts。
// 「关于我」页用这里的读写 + 条目化辅助（app_users.memory，RLS 允许本人增删改查）。
// 改动即时同步手机端（同一后端）。
import { getSupabase } from '@/lib/supabase/client';

export type UserMemory = {
  background?: string;
  profession?: string;
  general_preferences?: { style?: string[]; avoid?: string[] };
  language?: string;
  notes?: string[];
  [k: string]: unknown;
};

export type MemoryGroup =
  | 'background'
  | 'profession'
  | 'style'
  | 'avoid'
  | 'notes';

export type MemoryEntry = { id: string; group: MemoryGroup; value: string };

// 分组展示标签（背景 / 职业 / 学习偏好 / 希望避免 / 备注）。
export const GROUP_LABEL: Record<MemoryGroup, string> = {
  background: '背景',
  profession: '职业',
  style: '学习偏好',
  avoid: '希望避免',
  notes: '备注',
};

export const GROUP_ORDER: MemoryGroup[] = [
  'background',
  'profession',
  'style',
  'avoid',
  'notes',
];

export async function fetchUserMemory(): Promise<{
  memory: UserMemory;
  error: string | null;
}> {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { memory: {}, error: '未登录' };
  const { data, error } = await supabase
    .from('app_users')
    .select('memory')
    .eq('id', session.user.id)
    .single();
  if (error) return { memory: {}, error: error.message };
  return { memory: (data?.memory ?? {}) as UserMemory, error: null };
}

export async function saveUserMemory(
  memory: UserMemory,
): Promise<{ ok: boolean; error: string | null }> {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { ok: false, error: '未登录' };
  const { error } = await supabase
    .from('app_users')
    .update({ memory })
    .eq('id', session.user.id);
  return { ok: !error, error: error?.message ?? null };
}

// memory 对象 → 扁平条目列表（可逐条编辑/删除）。
export function memoryToEntries(m: UserMemory): MemoryEntry[] {
  const out: MemoryEntry[] = [];
  if (m.background)
    out.push({ id: 'background', group: 'background', value: m.background });
  if (m.profession)
    out.push({ id: 'profession', group: 'profession', value: m.profession });
  const gp = m.general_preferences ?? {};
  (gp.style ?? []).forEach(
    (v, i) => v && out.push({ id: `style:${i}`, group: 'style', value: v }),
  );
  (gp.avoid ?? []).forEach(
    (v, i) => v && out.push({ id: `avoid:${i}`, group: 'avoid', value: v }),
  );
  (m.notes ?? []).forEach(
    (v, i) => v && out.push({ id: `notes:${i}`, group: 'notes', value: v }),
  );
  return out;
}

// 条目列表 → memory 对象（保留 language 等未编辑字段；空字段省略）。
export function entriesToMemory(
  entries: MemoryEntry[],
  base: UserMemory,
): UserMemory {
  const out: UserMemory = { ...base };
  delete out.background;
  delete out.profession;
  delete out.general_preferences;
  delete out.notes;

  const style: string[] = [];
  const avoid: string[] = [];
  const notes: string[] = [];
  for (const e of entries) {
    const v = e.value.trim();
    if (!v) continue;
    if (e.group === 'background') out.background = v;
    else if (e.group === 'profession') out.profession = v;
    else if (e.group === 'style') style.push(v);
    else if (e.group === 'avoid') avoid.push(v);
    else if (e.group === 'notes') notes.push(v);
  }
  if (style.length || avoid.length) {
    out.general_preferences = {};
    if (style.length) out.general_preferences.style = style;
    if (avoid.length) out.general_preferences.avoid = avoid;
  }
  if (notes.length) out.notes = notes;
  return out;
}
