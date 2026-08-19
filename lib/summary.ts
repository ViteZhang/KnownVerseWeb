// 空间学习总结（复盘）数据层。
//
// 做什么：把一个学习空间里已生成的全部单元内容 + 用户的提问记录压成一份「内容摘要」，
// 交给 AI 写成一份可长期回看的复盘报告，落库保存，下次进来直接读缓存。
//
// 为什么借 ai-task 的 `ask` 任务：网页版仓库里没有 Edge Function 源码，
// 加不了 `gen_space_summary` 这种新任务。`ask` 的入参
// （spaceId / unitId / selectedText / sectionContext / question）刚好够用 ——
// 把内容摘要塞进 sectionContext、把「写一份复盘」的要求塞进 question 即可，
// 而且服务端照样会注入这个空间的学习档案，总结自带「因人而异」。
// 代价是它按「划词问 AI」计价，所以生成成功后前端补扣差价（见 lib/credits.ts）。
import { askAI, type CreditsExhausted } from '@/lib/ai';
import { blockText } from '@/lib/section-context';
import { getSupabase } from '@/lib/supabase/client';
import type { ContentBlock, PhaseWithUnits, SpaceSummary } from '@/lib/types';

// ── 摘要预算 ──────────────────────────────────────────────────────────
// 一次调用能塞进去的总字数。给得太大容易被服务端/模型截断，太小则总结空泛。
const DIGEST_BUDGET = 8000;
// 单个单元最少/最多分到的字数（单元多时按均分，但不低于下限，否则每单元只剩标题）。
const PER_UNIT_MIN = 200;
const PER_UNIT_MAX = 900;
// 提问记录最多带几条（只带问题本身，不带答案 —— 答案太长且不是复盘的输入）。
const MAX_QUESTIONS = 24;
const QUESTION_MAX_LEN = 60;

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

/** 一个单元压成几行：标题 → 导语 → 小节标题 → 正文节选（按预算截断）。 */
function digestUnit(
  label: string,
  title: string,
  content: ContentBlock[] | null,
  budget: number,
): string {
  const lines: string[] = [`### ${label} ${title}`];
  if (!content || content.length === 0) {
    lines.push('（这一单元还没生成内容）');
    return lines.join('\n');
  }
  let left = budget;
  const guide = content.find((b) => b.type === 'guide');
  if (guide) {
    const t = clip(blockText(guide), Math.min(120, left));
    if (t) {
      lines.push(`导语：${t}`);
      left -= t.length;
    }
  }
  const heads = content
    .filter((b) => b.type === 'h2' || b.type === 'h3')
    .map((b) => blockText(b))
    .filter(Boolean);
  if (heads.length > 0) {
    const t = clip(heads.join(' / '), Math.min(180, Math.max(left, 0)));
    lines.push(`小节：${t}`);
    left -= t.length;
  }
  const body = content
    .filter((b) => b.type === 'para' || b.type === 'card')
    .map((b) => blockText(b))
    .filter(Boolean)
    .join(' ');
  if (body && left > 40) lines.push(`正文节选：${clip(body, left)}`);
  return lines.join('\n');
}

export type DigestInput = {
  spaceName: string;
  learningType: string;
  phases: PhaseWithUnits[];
  /** unitId → content（只需要已生成的那些）。 */
  contents: Map<string, ContentBlock[] | null>;
  /** 用户在这个空间里问过的问题（新到旧）。 */
  questions: string[];
};

/** 把整个空间压成一份送进 AI 的内容摘要（纯字符串，可直接当 sectionContext）。 */
export function buildSpaceDigest(input: DigestInput): string {
  const { spaceName, learningType, phases, contents, questions } = input;
  const all = phases.flatMap((p) => p.units);
  const total = all.length;
  const done = all.filter((u) => u.status === 'done').length;
  const generated = all.filter((u) => (contents.get(u.id) ?? null) !== null);

  // 预算按「已生成的单元」均分，夹在上下限之间。
  const per = generated.length
    ? Math.min(PER_UNIT_MAX, Math.max(PER_UNIT_MIN, Math.floor(DIGEST_BUDGET / generated.length)))
    : PER_UNIT_MAX;

  const parts: string[] = [
    `## 学习空间：${spaceName}`,
    `学习类型：${learningType || '未标注'}；共 ${phases.length} 个阶段、${total} 个单元，已学完 ${done} 个。`,
    '',
    '## 各单元内容摘要',
  ];

  for (const p of phases) {
    parts.push(`\n## 阶段 ${p.idx}：${p.title}`);
    for (const u of p.units) {
      const c = contents.get(u.id) ?? null;
      const mark = u.status === 'done' ? '已学完' : c ? '已生成未学完' : '未生成';
      parts.push(digestUnit(`${p.idx}.${u.idx}（${mark}）`, u.title, c, per));
    }
  }

  if (questions.length > 0) {
    parts.push('\n## 我在这个空间里问过的问题（新到旧）');
    for (const q of questions.slice(0, MAX_QUESTIONS)) {
      parts.push(`- ${clip(q, QUESTION_MAX_LEN)}`);
    }
  } else {
    parts.push('\n## 我在这个空间里问过的问题\n（没有提问记录）');
  }

  const out = parts.join('\n');
  return out.length > DIGEST_BUDGET + 2000 ? `${out.slice(0, DIGEST_BUDGET + 2000)}…` : out;
}

// 写死的输出结构：小节固定，用户每次拿到的复盘格式一致，也便于以后做「历次总结对比」。
export const SUMMARY_PROMPT = `请基于上面这份「学习空间全量内容摘要」，为我写一份**学习复盘总结**。
这不是回答某个具体问题，而是把我在这个空间里学过的东西重新组织成一份可以长期回看的总结。

严格按下面的小节输出 Markdown（用 ## 作小节标题，不要开场白、不要复述本提示）：

## 一句话总括
一到两句话说清：我在这个空间里到底学成了什么。

## 知识地图
按阶段分点梳理主线，每个阶段 2–4 条。写「结论」，不要复述单元标题。

## 必须记住的核心概念
挑 8–12 个最关键的概念，每条一行，格式：**概念** —— 一句话解释，以及它为什么重要。

## 你问得最多的地方
根据「我问过的问题」推断我真实的困惑与薄弱环节，指出 2–4 条。
若没有提问记录，就说明这一点，并根据内容难度推测最容易卡住的地方。

## 还没吃透的部分
指出摘要里出现过、但我明显还没学到或还没展开的部分，并给出建议的复习顺序。

## 下一步
给 3 条具体建议（练习、延伸主题皆可），每条一行。

要求：用中文；直接称呼「你」；只输出上面这六个小节。`;

// ── 生成 ──────────────────────────────────────────────────────────────
export type GenerateSummaryResult =
  | { content: string; error: null }
  | { content: null; error: string; exhausted?: CreditsExhausted };

/** 调 AI 写这一份复盘。anchorUnitId 只用于满足 ask 的入参（服务端按它定位空间上下文）。 */
export async function generateSpaceSummary(
  spaceId: string,
  anchorUnitId: string,
  spaceName: string,
  digest: string,
): Promise<GenerateSummaryResult> {
  const r = await askAI({
    spaceId,
    unitId: anchorUnitId,
    // selectedText 在服务端的 ask 模板里是「用户选中的那段话」。总结没有选区，
    // 给一句能自洽的话，别留空字符串让模板变成半句。
    selectedText: `《${spaceName}》这个学习空间的全部内容`,
    sectionContext: digest,
    question: SUMMARY_PROMPT,
  });
  if (r.error !== null) {
    return { content: null, error: r.error, exhausted: r.exhausted };
  }
  return { content: r.answer, error: null };
}

// ── 读取空间全量内容（生成摘要的原料）────────────────────────────────
export async function fetchSpaceContents(
  spaceId: string,
): Promise<{ contents: Map<string, ContentBlock[] | null>; error: string | null }> {
  const { data, error } = await getSupabase()
    .from('units')
    .select('id,content')
    .eq('space_id', spaceId);
  if (error) return { contents: new Map(), error: error.message };
  const m = new Map<string, ContentBlock[] | null>();
  for (const r of data ?? []) {
    const c = (r as { id: string; content: ContentBlock[] | null }).content;
    m.set((r as { id: string }).id, Array.isArray(c) && c.length > 0 ? c : null);
  }
  return { contents: m, error: null };
}

// ── 落库 / 读缓存 ─────────────────────────────────────────────────────
// space_summaries 这张表要跑一段 SQL 才有（见 README）。没建之前整个功能照样能用，
// 只是每次进来都得重新生成 —— 所以这里把「表不存在」单独标出来，UI 好说人话。
function tableMissing(e: { code?: string; message?: string }): boolean {
  return (
    e.code === 'PGRST205' ||
    e.code === '42P01' ||
    (e.message ?? '').includes('Could not find the table')
  );
}

export async function fetchLatestSummary(
  spaceId: string,
): Promise<{ row: SpaceSummary | null; missing: boolean; error: string | null }> {
  try {
    const { data, error } = await getSupabase()
      .from('space_summaries')
      .select('id,space_id,content,unit_total,unit_done,created_at')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (tableMissing(error)) return { row: null, missing: true, error: null };
      return { row: null, missing: false, error: error.message };
    }
    return { row: (data as SpaceSummary) ?? null, missing: false, error: null };
  } catch (e) {
    return { row: null, missing: false, error: e instanceof Error ? e.message : 'network' };
  }
}

export async function saveSummary(input: {
  spaceId: string;
  content: string;
  unitTotal: number;
  unitDone: number;
}): Promise<{ ok: boolean; missing: boolean; error: string | null }> {
  const sb = getSupabase();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session?.user) return { ok: false, missing: false, error: 'NO_SESSION' };
  try {
    const { error } = await sb.from('space_summaries').insert({
      user_id: session.user.id,
      space_id: input.spaceId,
      content: input.content,
      unit_total: input.unitTotal,
      unit_done: input.unitDone,
    });
    if (error) {
      if (tableMissing(error)) return { ok: false, missing: true, error: null };
      return { ok: false, missing: false, error: error.message };
    }
    return { ok: true, missing: false, error: null };
  } catch (e) {
    return { ok: false, missing: false, error: e instanceof Error ? e.message : 'network' };
  }
}
