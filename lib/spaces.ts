// 空间 / 路径数据层。移植自 App src/lib/spaces.ts。
// 注：按「严格最小写入」决策，markUnitDone 只 update units.status，
// 不写 learning_events、不触发 profile 归纳（与 App 副作用刻意不对齐）。
import { getSupabase } from '@/lib/supabase/client';
import type {
  ComputedPhase,
  PathUnit,
  PhaseWithUnits,
  SpaceCard,
  SpacePath,
} from '@/lib/types';

// ── 读某空间 + 其 phases/units（路径页）────────────────────────────────
export async function fetchSpacePath(spaceId: string): Promise<SpacePath> {
  const supabase = getSupabase();
  const one = await supabase
    .from('spaces')
    .select('id,name,learning_type')
    .eq('id', spaceId)
    .maybeSingle();
  if (one.error) return { space: null, phases: [], error: one.error.message };
  const space = one.data;
  if (!space) return { space: null, phases: [], error: null };

  const ph = await supabase
    .from('phases')
    .select('id,idx,title,status')
    .eq('space_id', space.id)
    .order('idx');
  if (ph.error) return { space, phases: [], error: ph.error.message };

  const un = await supabase
    .from('units')
    .select('id,idx,title,status,phase_id,source')
    .eq('space_id', space.id)
    .order('idx');
  if (un.error) return { space, phases: [], error: un.error.message };

  const phases: PhaseWithUnits[] = (ph.data ?? []).map((p: any) => ({
    id: p.id,
    idx: p.idx,
    title: p.title,
    status: p.status,
    units: (un.data ?? [])
      .filter((u: any) => u.phase_id === p.id)
      .map((u: any) => ({
        id: u.id,
        idx: u.idx,
        title: u.title,
        status: u.status,
        source: u.source ?? 'generated',
      })),
  }));

  return { space, phases, error: null };
}

// ── 阶段解锁（读时计算）。直接照搬 App spaces.ts:195。────────────────────
export function computePhaseStatuses(phases: PhaseWithUnits[]): ComputedPhase[] {
  let priorAllDone = true;
  return phases.map((p) => {
    const hasUnits = p.units.length > 0;
    const allDone = hasUnits && p.units.every((u) => u.status === 'done');
    const importedReady =
      hasUnits &&
      p.units.every((u) => u.source === 'imported' && u.status !== 'not_generated');
    let computed: 'done' | 'active' | 'locked';
    if (allDone) {
      computed = 'done';
    } else if (importedReady) {
      computed = 'active';
    } else if (priorAllDone) {
      computed = 'active';
      priorAllDone = false;
    } else {
      computed = 'locked';
    }
    return { ...p, computed };
  });
}

/** 断点单元：按 (phase.idx, unit.idx) 顺序第一个未完成的单元。 */
export function findNextUnit(phases: PhaseWithUnits[]): PathUnit | null {
  for (const p of phases) {
    for (const u of p.units) {
      if (u.status !== 'done') return u;
    }
  }
  return null;
}

// ── 标记学完（最小写入：仅 update status）────────────────────────────────
export async function markUnitDone(
  unitId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const up = await getSupabase()
    .from('units')
    .update({ status: 'done' })
    .eq('id', unitId);
  if (up.error) return { ok: false, error: up.error.message };
  return { ok: true, error: null };
}

// ── 首页空间卡片（进度 + 断点，读时计算）。移植自 App spaces.ts:319。──────
export async function fetchSpacesOverview(): Promise<{
  spaces: SpaceCard[];
  error: string | null;
}> {
  const supabase = getSupabase();
  const sp = await supabase
    .from('spaces')
    .select('id,name,learning_type,created_at')
    .order('created_at', { ascending: false });
  if (sp.error) return { spaces: [], error: sp.error.message };
  const spaces = sp.data ?? [];
  if (spaces.length === 0) return { spaces: [], error: null };

  const ids = spaces.map((s: any) => s.id);
  const ph = await supabase.from('phases').select('id,space_id,idx').in('space_id', ids);
  const un = await supabase
    .from('units')
    .select('id,space_id,phase_id,idx,title,status')
    .in('space_id', ids);
  if (ph.error) return { spaces: [], error: ph.error.message };
  if (un.error) return { spaces: [], error: un.error.message };

  const phaseIdx = new Map<string, number>(
    (ph.data ?? []).map((p: any) => [p.id, p.idx]),
  );

  const cards: SpaceCard[] = spaces.map((s: any) => {
    const units = (un.data ?? []).filter((u: any) => u.space_id === s.id);
    const sorted = units.slice().sort((a: any, b: any) => {
      const pa = phaseIdx.get(a.phase_id) ?? 0;
      const pb = phaseIdx.get(b.phase_id) ?? 0;
      return pa !== pb ? pa - pb : a.idx - b.idx;
    });
    const total = sorted.length;
    const done = sorted.filter((u: any) => u.status === 'done').length;
    const next = sorted.find((u: any) => u.status !== 'done');
    return {
      id: s.id,
      name: s.name,
      learningType: s.learning_type,
      total,
      done,
      nextUnitTitle: next?.title ?? null,
      nextUnitId: next?.id ?? null,
      finished: total > 0 && done === total,
    };
  });

  return { spaces: cards, error: null };
}
