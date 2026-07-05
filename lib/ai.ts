// 调用 Edge Function ai-task 的客户端封装。移植自 App src/lib/ai.ts。
// invoke 自动带当前会话 JWT；档案注入在 Edge Function 内部完成，网页端不碰。
// V1 非流式（不移植 genUnitStream）。
import { getSupabase } from '@/lib/supabase/client';
import type { ContentBlock } from '@/lib/types';

export type AskParams = {
  spaceId: string;
  unitId: string;
  selectedText: string;
  sectionContext: string;
  question: string;
};

export type AskResult =
  | { answer: string; error: null }
  | { answer: null; error: string };

const FRIENDLY_FALLBACK = 'AI 暂时没能回答，请稍后再试。';

/** 问 AI（task='ask'）。返回 Markdown 文本或友好错误文案。 */
export async function askAI(params: AskParams): Promise<AskResult> {
  try {
    const { data, error } = await getSupabase().functions.invoke('ai-task', {
      body: { task: 'ask', ...params },
    });
    if (error) return { answer: null, error: FRIENDLY_FALLBACK };
    if (data && typeof data.answer === 'string' && data.answer.trim()) {
      return { answer: data.answer, error: null };
    }
    return { answer: null, error: FRIENDLY_FALLBACK };
  } catch {
    return { answer: null, error: FRIENDLY_FALLBACK };
  }
}

export type GenUnitResult =
  | { content: ContentBlock[]; error: null }
  | { content: null; error: string };

const GEN_FALLBACK = '内容生成失败，请稍后重试。';

/** 生成单元内容（task='gen_unit'，非流式）。 */
export async function genUnit(
  spaceId: string,
  unitId: string,
): Promise<GenUnitResult> {
  try {
    const { data, error } = await getSupabase().functions.invoke('ai-task', {
      body: { task: 'gen_unit', spaceId, unitId },
    });
    if (error) return { content: null, error: GEN_FALLBACK };
    if (data && Array.isArray(data.content) && data.content.length > 0) {
      return { content: data.content as ContentBlock[], error: null };
    }
    return { content: null, error: GEN_FALLBACK };
  } catch {
    return { content: null, error: GEN_FALLBACK };
  }
}
