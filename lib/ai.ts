// 调用 Edge Function ai-task 的客户端封装。移植自 App src/lib/ai.ts。
// invoke 自动带当前会话 JWT；档案注入在 Edge Function 内部完成，网页端不碰。
// V1 非流式（不移植 genUnitStream）。
import { getSupabase } from '@/lib/supabase/client';
import type { ContentBlock, PathPhase } from '@/lib/types';

/** 当前登录用户 id（记忆注入 / 用量归属用；未登录返回 undefined）。 */
async function currentUserId(): Promise<string | undefined> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  return session?.user?.id;
}

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

// ── 入学访谈追问（task='interview_next'）。移植自 App src/lib/ai.ts ──────
export type InterviewTurn = { role: 'ai' | 'user'; text: string };
export type InterviewResult =
  | { status: 'ask' | 'done'; question: string; error: null }
  | { status: null; question: ''; error: string };

const INTERVIEW_FALLBACK = '访谈服务暂时不可用，请稍后再试。';

export async function interviewNext(
  initialInput: string,
  history: InterviewTurn[],
): Promise<InterviewResult> {
  try {
    const userId = await currentUserId();
    const { data, error } = await getSupabase().functions.invoke('ai-task', {
      body: { task: 'interview_next', initialInput, history, userId },
    });
    if (error) return { status: null, question: '', error: INTERVIEW_FALLBACK };
    if (data && (data.status === 'ask' || data.status === 'done')) {
      return {
        status: data.status,
        question: typeof data.question === 'string' ? data.question : '',
        error: null,
      };
    }
    return { status: null, question: '', error: INTERVIEW_FALLBACK };
  } catch {
    return { status: null, question: '', error: INTERVIEW_FALLBACK };
  }
}

// ── 理解摘要（task='summarize_understanding'）───────────────────────────
export type UnderstandingStatic = {
  goal: { domain?: string; target_state?: string; deadline?: string | null };
  baseline: { summary?: string };
  time: { summary?: string };
  preferences: { style?: string[]; avoid?: string[] };
};
export type Understanding = {
  space_name: string;
  static: UnderstandingStatic;
  inferences: { learning_type?: string; pace?: string; depth_level?: string };
};
export type SummarizeResult =
  | { data: Understanding; error: null }
  | { data: null; error: string };

const SUMMARIZE_FALLBACK = '整理理解时出错，请稍后再试。';

export async function summarizeUnderstanding(
  initialInput: string,
  history: InterviewTurn[],
): Promise<SummarizeResult> {
  try {
    const userId = await currentUserId();
    const { data, error } = await getSupabase().functions.invoke('ai-task', {
      body: { task: 'summarize_understanding', initialInput, history, userId },
    });
    if (error) return { data: null, error: SUMMARIZE_FALLBACK };
    if (data && data.static) return { data: data as Understanding, error: null };
    return { data: null, error: SUMMARIZE_FALLBACK };
  } catch {
    return { data: null, error: SUMMARIZE_FALLBACK };
  }
}

// ── 抽取用户级记忆（task='extract_user_memory'）。访谈结束顺手抽，失败不阻塞。 ──
export async function extractUserMemory(
  initialInput: string,
  history: InterviewTurn[],
): Promise<void> {
  try {
    const userId = await currentUserId();
    if (!userId) return;
    await getSupabase().functions.invoke('ai-task', {
      body: { task: 'extract_user_memory', initialInput, history, userId },
    });
  } catch {
    // 静默：用户记忆是增强项，不该影响建空间主流程。
  }
}

// ── 生成学习路径（task='gen_path'）─────────────────────────────────────
export type GenPathResult =
  | { phases: PathPhase[]; error: null }
  | { phases: null; error: string };

const GENPATH_FALLBACK = '生成路径失败，请稍后重试。';

export async function genPath(spaceId: string): Promise<GenPathResult> {
  try {
    const userId = await currentUserId();
    const { data, error } = await getSupabase().functions.invoke('ai-task', {
      body: { task: 'gen_path', spaceId, userId },
    });
    if (error) return { phases: null, error: GENPATH_FALLBACK };
    if (data && Array.isArray(data.phases) && data.phases.length > 0) {
      return { phases: data.phases as PathPhase[], error: null };
    }
    return { phases: null, error: GENPATH_FALLBACK };
  } catch {
    return { phases: null, error: GENPATH_FALLBACK };
  }
}
