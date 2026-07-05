// 断点续学（施工 §6，唯一后端增强 reading_progress 表）。
// 阅读时防抖 upsert 当前 space_id/unit_id/anchor；首页/路径页「继续学习」读它跳转。
// 主键 (user_id, space_id)，last-write-wins。
import { getSupabase } from '@/lib/supabase/client';

export type ReadingProgress = {
  unit_id: string;
  anchor: string | null;
};

/** upsert 当前阅读位置。失败静默（断点是增强项，不阻塞阅读）。 */
export async function saveReadingProgress(
  spaceId: string,
  unitId: string,
  anchor: string | null,
): Promise<void> {
  try {
    const supabase = getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    await supabase.from('reading_progress').upsert(
      {
        user_id: session.user.id,
        space_id: spaceId,
        unit_id: unitId,
        anchor,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,space_id' },
    );
  } catch {
    // 静默：断点写入不该影响阅读。
  }
}

/** 读某空间的断点位置（无表/无记录都返回 null，不报错）。 */
export async function fetchReadingProgress(
  spaceId: string,
): Promise<ReadingProgress | null> {
  try {
    const { data, error } = await getSupabase()
      .from('reading_progress')
      .select('unit_id, anchor')
      .eq('space_id', spaceId)
      .maybeSingle();
    if (error || !data) return null;
    return { unit_id: data.unit_id, anchor: data.anchor ?? null };
  } catch {
    return null;
  }
}
