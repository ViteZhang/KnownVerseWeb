// 积分余额读取(Phase 3 §9)。走 get_credit_status RPC:服务端 auth.uid() 认人 +
// 「读前懒重置」,所以余额条拿到的一定是当月已刷新的真值,不在客户端算。
import { getSupabase } from '@/lib/supabase/client';

export type CreditStatus = {
  balance: number; // granted + purchased
  granted: number;
  purchased: number;
  monthly: number; // 本档月度发放量(免费 80 / 会员 800)
  periodEnd: string | null; // 本轮到期(免费=下月刷新锚点;会员=next_billed_at)
  status: string; // none / active / past_due / canceled
};

export async function getCreditStatus(): Promise<CreditStatus | null> {
  try {
    const { data, error } = await getSupabase().rpc('get_credit_status');
    if (error || !data?.ok) return null;
    return {
      balance: data.balance ?? 0,
      granted: data.granted ?? 0,
      purchased: data.purchased ?? 0,
      monthly: data.monthly ?? 0,
      periodEnd: data.period_end ?? null,
      status: data.status ?? 'none',
    };
  } catch {
    return null;
  }
}

/** 距下次刷新的人话文案(免费档按月;会员按 next_billed_at)。 */
export function resetHint(periodEnd: string | null): string {
  if (!periodEnd) return '';
  const end = new Date(periodEnd).getTime();
  const days = Math.ceil((end - Date.now()) / 86400000);
  if (days <= 0) return '即将刷新';
  if (days === 1) return '明天刷新';
  return `${days} 天后刷新`;
}
