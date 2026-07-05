// 提问记录读写。移植自 App src/lib/questions.ts。
// 注：按「严格最小写入」决策，saveQuestion 只 insert questions，不写 learning_events。
import { getSupabase } from '@/lib/supabase/client';
import type { QuestionRecord } from '@/lib/types';

export type SaveQuestionInput = {
  spaceId: string;
  unitId: string;
  selectedText: string;
  question: string;
  answer: string;
};

export type SaveResult = { ok: boolean; error: string | null; id?: string | null };

/**
 * 把一条问答写入 questions。失败不阻塞阅读——静默重试一次 + 记日志。
 * RLS：user_id = auth.uid()，插入时必须带上当前用户 id（WITH CHECK）。
 */
export async function saveQuestion(input: SaveQuestionInput): Promise<SaveResult> {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    console.warn('[questions] 无登录会话，跳过写入。');
    return { ok: false, error: 'NO_SESSION' };
  }

  const row = {
    user_id: session.user.id,
    space_id: input.spaceId,
    unit_id: input.unitId,
    selected_text: input.selectedText,
    question: input.question,
    answer: input.answer,
  };

  const attempt = () =>
    supabase.from('questions').insert(row).select('id').single();

  let { data, error } = await attempt();
  if (error) ({ data, error } = await attempt());

  if (error) {
    console.warn('[questions] 写入失败（已重试一次）:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null, id: (data?.id as string) ?? null };
}

/** 读取某 space 的全部提问，按时间倒序；联表取所属单元标题。 */
export async function fetchQuestions(
  spaceId: string,
): Promise<{ rows: QuestionRecord[]; error: string | null }> {
  const { data, error } = await getSupabase()
    .from('questions')
    .select('id, selected_text, question, answer, created_at, unit_id, units(title)')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false });

  if (error) return { rows: [], error: error.message };

  const rows: QuestionRecord[] = (data ?? []).map((r: any) => ({
    id: r.id,
    selected_text: r.selected_text,
    question: r.question,
    answer: r.answer,
    created_at: r.created_at,
    unit_id: r.unit_id,
    unit_title: r.units?.title ?? null,
  }));

  return { rows, error: null };
}
