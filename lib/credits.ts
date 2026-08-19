// 纯积分制:余额读取 + 用户端积分动作(《终版》§3、§4)。
// 余额走 get_credit_status(服务端 auth.uid() 认人),签到/兑换/建空间扣费走各自 RPC。
// 客户端只读余额,一切写入在服务端 SECURITY DEFINER 函数里。
import { getSupabase } from '@/lib/supabase/client';

export type CreditStatus = {
  free: number; // 免费桶(签到/邀请;上限 free_cap;先被扣)
  paid: number; // 充值桶(新手包/激活码;无上限、永不过期;后被扣)
  balance: number; // free + paid
  freeCap: number;
  checkinCredits: number;
  checkedToday: boolean;
};

export async function getCreditStatus(): Promise<CreditStatus | null> {
  try {
    const { data, error } = await getSupabase().rpc('get_credit_status');
    if (error || !data?.ok) return null;
    return {
      free: data.free ?? 0,
      paid: data.paid ?? 0,
      balance: data.balance ?? 0,
      freeCap: data.free_cap ?? 100,
      checkinCredits: data.checkin_credits ?? 5,
      checkedToday: Boolean(data.checked_today),
    };
  } catch {
    return null;
  }
}

// 每日签到(§3.2)。ok+granted+capped;capped=true 表示免费桶已满、记为已签但发 0。
export type ClaimResult = { ok: boolean; granted: number; capped: boolean; reason?: string };

export async function claimDaily(): Promise<ClaimResult> {
  try {
    const { data, error } = await getSupabase().rpc('claim_daily_credits');
    if (error || !data) return { ok: false, granted: 0, capped: false, reason: 'network' };
    return {
      ok: Boolean(data.ok),
      granted: data.granted ?? 0,
      capped: Boolean(data.capped),
      reason: data.reason,
    };
  } catch {
    return { ok: false, granted: 0, capped: false, reason: 'network' };
  }
}

// 兑换激活码(§4.2)。失败原因统一为 invalid_code(不区分不存在/已用/过期)。
export type RedeemResult = { ok: boolean; credits?: number; reason?: string };

export async function redeemCode(code: string): Promise<RedeemResult> {
  try {
    const { data, error } = await getSupabase().rpc('redeem_credit_code', { p_code: code });
    if (error || !data) return { ok: false, reason: 'network' };
    return { ok: Boolean(data.ok), credits: data.credits, reason: data.reason };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

// 幂等钥匙后缀:老 webview 里 crypto.randomUUID 可能不存在,退回时间戳 + 随机数。
export function newIdemSuffix(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// 建空间扣费(§5.3):访谈开始前调,idem=客户端一次性 uuid(重试不重扣)。
export type SpendResult = { ok: boolean; balance?: number; reason?: string; needed?: number };

export async function spendSpaceCreation(idem: string): Promise<SpendResult> {
  try {
    const { data, error } = await getSupabase().rpc('spend_space_creation', { p_idem: idem });
    if (error || !data) return { ok: false, reason: 'network' };
    return { ok: Boolean(data.ok), balance: data.balance, reason: data.reason, needed: data.needed };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

// 单元(重)生成扣费。线上库的口径与《终版》文档并不一致,实测(PostgREST 报的签名):
//   - 没有文档里的 spend_credits(p_cost,p_reason,p_idem);
//   - 有一个 spend_credits(p_user,p_cost,p_reason,p_idem) —— 要显式传用户 id;
//   - 建空间走的是 spend_space_creation(p_idem) 这种「服务端 auth.uid() 认人」的安全包装。
// 所以这里先调同款安全包装 spend_unit_generation(p_idem)(按 README 的 SQL 建好后自动走这条),
// 函数不存在再回落到现有的 4 参数 spend_credits。两条路用同一把 p_idem,幂等,不会重复扣。
//
// 首次生成由 ai-task 内部按 idem=<unit_id> 扣;重新生成用新钥匙,故会真扣一次。
export async function spendUnitGeneration(
  idem: string,
  cost: number,
): Promise<SpendResult> {
  const shape = (d: {
    ok?: boolean;
    balance?: number;
    reason?: string;
    needed?: number;
  }): SpendResult => ({
    ok: Boolean(d.ok),
    balance: d.balance,
    reason: d.reason,
    needed: d.needed,
  });
  const missing = (e: { code?: string; message?: string }) =>
    e.code === 'PGRST202' || (e.message ?? '').includes('Could not find the function');

  const sb = getSupabase();
  try {
    // ① 安全包装(推荐):服务端自己认人,前端连用户 id 都不用碰。
    const { data, error } = await sb.rpc('spend_unit_generation', { p_idem: idem });
    if (!error && data) return shape(data);
    if (error && !missing(error)) return { ok: false, reason: error.message || 'rpc_error' };

    // ② 回落:线上现有的 4 参数版,必须带上自己的 user id。
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return { ok: false, reason: 'not_authenticated' };
    const r = await sb.rpc('spend_credits', {
      p_user: user.id,
      p_cost: cost,
      p_reason: 'unit_generation',
      p_idem: idem,
    });
    // 原因原样带出(函数不存在 / 未授权 / 网络都要能区分),排查扣费问题只能靠它。
    if (r.error) return { ok: false, reason: r.error.message || 'rpc_error' };
    if (!r.data) return { ok: false, reason: 'empty_response' };
    return shape(r.data);
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'network' };
  }
}

// 空间学习总结(复盘)的补扣。
// 总结这次 LLM 调用是借 ai-task 的 `ask` 任务发出去的 —— 服务端已经按「划词问 AI」
// 扣了 cost_ask_ai(默认 1)。但总结送进去的是整个空间的内容摘要,成本远高于一次划词追问,
// 所以生成成功后前端再补扣一次差价,让一次总结的总价落在 cost_space_summary(默认 10)。
//
// 补扣走安全包装 spend_space_summary(p_idem)(服务端 auth.uid() 认人 + 自己算差价),
// 与 spend_unit_generation 同款。SQL 见 README;没建之前这里返回 function_missing,
// 调用方据此只提示、不拦着用户看已经生成好的总结(那一次就只花了 cost_ask_ai)。
export async function spendSpaceSummary(idem: string): Promise<SpendResult> {
  const sb = getSupabase();
  try {
    const { data, error } = await sb.rpc('spend_space_summary', { p_idem: idem });
    if (error) {
      const missing =
        error.code === 'PGRST202' ||
        (error.message ?? '').includes('Could not find the function');
      return { ok: false, reason: missing ? 'function_missing' : error.message || 'rpc_error' };
    }
    if (!data) return { ok: false, reason: 'empty_response' };
    return {
      ok: Boolean(data.ok),
      balance: data.balance,
      reason: data.reason,
      needed: data.needed,
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'network' };
  }
}

// 积分流水(§8⑤)。倒序;RLS 只返回本人。
export type LedgerRow = {
  id: number;
  delta: number;
  reason: string;
  balance_after: number | null;
  created_at: string;
};

export async function fetchLedger(limit = 100): Promise<LedgerRow[]> {
  try {
    const { data, error } = await getSupabase()
      .from('credit_ledger')
      .select('id,delta,reason,balance_after,created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as LedgerRow[];
  } catch {
    return [];
  }
}

// 流水 reason → 人话(来源/去向)。
export const REASON_LABEL: Record<string, string> = {
  welcome_bonus: '注册新手包',
  daily_checkin: '每日签到',
  referral_invitee: '接受邀请',
  referral_inviter: '邀请好友',
  redeem_code: '兑换激活码',
  space_creation: '新建学习空间',
  unit_generation: '生成学习单元',
  ask_ai: '划词问 AI',
  space_summary: '空间学习总结',
  refund: '退回积分',
};
