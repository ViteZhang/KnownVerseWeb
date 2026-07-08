// 邀请 / 额度。移植自 App src/lib/referral.ts（开放验证版 Stage1 §4/§6/§7）。
// 每人一个持久可复用的 referral_code；被邀请者应用邀请码后走 SECURITY DEFINER 的
// RPC apply_referral（双边 +1、封顶 3）。安全：额度/邀请的写入全在服务端 RPC，
// 客户端只读自己的 app_users 行（owner RLS）。
// 与 App 的唯一区别：暂存介质用 localStorage（Web）而非 AsyncStorage。
'use client';
import { getSupabase } from '@/lib/supabase/client';

/** 邀请途径解锁封顶（与服务端 apply_referral 的 least(...,3) 同值）。 */
export const INVITE_BONUS_CAP = 3;
/** 缺省基础额度（与 DB base_space_quota default 同值，作离线兜底）。 */
export const DEFAULT_QUOTA = 2;

export type ReferralInfo = {
  referralCode: string | null;
  invitedCount: number; // 我成功邀请的人数（invited_count，不封顶）
  spaceQuota: number; // 有效额度 = 四来源之和（generated）
  baseQuota: number;
  referralBonus: number; // 被邀请甜头（0/1）
  inviteSpaceBonus: number; // 邀请他人累加（0..3）
  error: string | null;
};

const EMPTY: ReferralInfo = {
  referralCode: null,
  invitedCount: 0,
  spaceQuota: DEFAULT_QUOTA,
  baseQuota: DEFAULT_QUOTA,
  referralBonus: 0,
  inviteSpaceBonus: 0,
  error: null,
};

/** 读自己的邀请码 + 额度来源（邀请好友页 §7；首页空间上限判断 §2）。 */
export async function fetchReferralInfo(): Promise<ReferralInfo> {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { ...EMPTY, error: '未登录' };

  const { data, error } = await supabase
    .from('app_users')
    .select(
      'referral_code, space_quota, base_space_quota, referral_bonus, invite_space_bonus, invited_count',
    )
    .eq('id', session.user.id)
    .maybeSingle();
  if (error) return { ...EMPTY, error: error.message };

  const row = (data ?? {}) as Record<string, number | string | null>;
  return {
    referralCode: (row.referral_code as string) ?? null,
    invitedCount: (row.invited_count as number) ?? 0,
    spaceQuota: (row.space_quota as number) ?? DEFAULT_QUOTA,
    baseQuota: (row.base_space_quota as number) ?? DEFAULT_QUOTA,
    referralBonus: (row.referral_bonus as number) ?? 0,
    inviteSpaceBonus: (row.invite_space_bonus as number) ?? 0,
    error: null,
  };
}

export type ApplyReferralReason =
  | 'not_authenticated'
  | 'already_referred'
  | 'invalid_code'
  | 'self_referral'
  | 'rpc_error';

export type ApplyReferralResult = {
  applied: boolean;
  reason?: ApplyReferralReason;
};

/** 应用邀请码。服务端做全部校验与写入；客户端只传码。 */
export async function applyReferral(code: string): Promise<ApplyReferralResult> {
  const { data, error } = await getSupabase().rpc('apply_referral', {
    p_code: code.trim(),
  });
  if (error) return { applied: false, reason: 'rpc_error' };
  return (data ?? { applied: false }) as ApplyReferralResult;
}

// ── 邀请码捕获暂存（§6.2）：登录/注册页录入 → 本地暂存 → 成功登录后应用一次 ──────
const PENDING_KEY = 'pending_referral_code';

/** 登录/注册页录入邀请码时暂存（跨「邮箱验证码确认」也能留住）。 */
export function setPendingReferral(code: string): void {
  const c = code.trim();
  if (c && typeof window !== 'undefined') {
    window.localStorage.setItem(PENDING_KEY, c);
  }
}

export function clearPendingReferral(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PENDING_KEY);
  }
}

/**
 * 登录成功后应用暂存的邀请码（§6.2）。幂等：服务端保证「已被邀请/无效」只静默无操作。
 * 无效/已被邀请/自邀都清掉暂存（不再重试）；仅 rpc_error 保留以便下次重试。
 * 返回 null 表示本地没有待应用的码。
 */
export async function applyPendingReferral(): Promise<ApplyReferralResult | null> {
  if (typeof window === 'undefined') return null;
  const code = window.localStorage.getItem(PENDING_KEY);
  if (!code) return null;
  const res = await applyReferral(code);
  if (res.reason !== 'rpc_error') clearPendingReferral();
  return res;
}

/** 应用结果 → 面向用户的友好文案（手动兑换用）。 */
export function applyResultMessage(res: ApplyReferralResult): {
  ok: boolean;
  text: string;
} {
  if (res.applied) {
    return { ok: true, text: '已为你和邀请人各解锁 1 个学习空间' };
  }
  switch (res.reason) {
    case 'already_referred':
      return { ok: false, text: '你已经用过邀请码了，每人限用一次。' };
    case 'self_referral':
      return { ok: false, text: '不能使用自己的邀请码。' };
    case 'invalid_code':
      return { ok: false, text: '邀请码无效，请检查后重试。' };
    case 'not_authenticated':
      return { ok: false, text: '登录状态失效，请重新登录后再试。' };
    default:
      return { ok: false, text: '兑换失败，请稍后再试。' };
  }
}
