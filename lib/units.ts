// 单元数据层。移植自 App src/lib/units.ts（去掉 SEED_UNIT_ID，web 一律从路由参数拿 unitId）。
import { getSupabase } from '@/lib/supabase/client';
import type { ContentBlock, Unit } from '@/lib/types';

export type FetchUnitResult =
  | { unit: Unit; error: null }
  | { unit: null; error: string };

/** 按 id 读取一条单元。 */
export async function fetchUnitById(id: string): Promise<FetchUnitResult> {
  const { data, error } = await getSupabase()
    .from('units')
    .select('id, space_id, phase_id, idx, title, status, content, generated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) return { unit: null, error: error.message };
  if (!data) return { unit: null, error: 'NO_ROWS' };
  return { unit: data as Unit, error: null };
}

/**
 * 把生成出的块数组写回 units 并标记 learning。失败静默重试一次。
 * 因「一次生成、永久固化」，两端看到同一份，天然同步。
 */
export async function persistUnitContent(
  unitId: string,
  content: ContentBlock[],
): Promise<{ ok: boolean; error: string | null }> {
  const row = {
    content,
    status: 'learning',
    generated_at: new Date().toISOString(),
  };
  const supabase = getSupabase();
  const attempt = () => supabase.from('units').update(row).eq('id', unitId);

  let { error } = await attempt();
  if (error) ({ error } = await attempt());
  if (error) {
    console.warn('[units] 固化失败（已重试一次）:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}
