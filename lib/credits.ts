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

// 通用扣费(§3.3 spend_credits,已 grant 给 authenticated)。
// 目前只用于「重新生成单元」:首次生成由 ai-task 内部按 idem=<unit_id> 扣,
// 同一单元再生成会命中幂等不再扣 —— 重生成的那一次由前端补一笔新 idem 的扣费,
// 保证「重新生成 = 重新花积分」。p_idem 用一次性 uuid,网络重试不会重扣。
export async function spendCredits(
  cost: number,
  reason: string,
  idem: string,
): Promise<SpendResult> {
  try {
    const { data, error } = await getSupabase().rpc('spend_credits', {
      p_cost: cost,
      p_reason: reason,
      p_idem: idem,
    });
    if (error || !data) return { ok: false, reason: 'network' };
    return { ok: Boolean(data.ok), balance: data.balance, reason: data.reason, needed: data.needed };
  } catch {
    return { ok: false, reason: 'network' };
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
  refund: '退回积分',
};
