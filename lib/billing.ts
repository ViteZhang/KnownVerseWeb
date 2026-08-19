// 纯积分制:所有「数字」的前端读取口(《终版》§2)。
// 只从 billing_config_public 视图取(新手包 / 签到 / 上限 / 各动作成本),永不写死这些数字。
// 用无 Cookie 的匿名客户端读,好让积分说明页保持 SSG/ISR(不被会话 Cookie 拖成动态渲染)。
import { createClient } from '@supabase/supabase-js';

export type BillingConfig = {
  welcome_credits: number;
  daily_checkin_credits: number;
  free_balance_cap: number;
  referral_credits: number;
  cost_space_creation: number;
  cost_unit_generation: number;
  cost_ask_ai: number;
  space_hard_cap: number;
  // 空间学习总结(复盘)的「总价」。billing_config_public 里暂时没有这一列 ——
  // 读不到就用下面的兜底值,与 README 里那段 SQL 写死的口径保持一致。
  cost_space_summary: number;
};

// 兜底:视图读不到时用锁定默认值(与 billing_config 表默认一致),页面永不空白。
export const BILLING_FALLBACK: BillingConfig = {
  welcome_credits: 150,
  daily_checkin_credits: 5,
  free_balance_cap: 100,
  referral_credits: 50,
  cost_space_creation: 50,
  cost_unit_generation: 10,
  cost_ask_ai: 1,
  space_hard_cap: 50,
  cost_space_summary: 10,
};

// 充值档位:线下微信报价单(《终版》§0、§8⑥)。系统里只有「激活码面额」,
// 这三档只是营销展示与对账口径,不是 SKU、不进 billing_config。标定前不对外调整。
export type CreditPack = { price: string; credits: number; note: string; hero?: boolean };
export const CREDIT_PACKS: CreditPack[] = [
  { price: '¥9.9', credits: 300, note: '约一个学习目标的大半' },
  { price: '¥29.9', credits: 1000, note: '约三个学习目标', hero: true },
  { price: '¥68', credits: 2500, note: '约七个学习目标' },
];

// 一个学习目标从头走完的锚点(《终版》§8⑥):建空间 50 + 约 24 单元 240 + 追问 50 ≈ 340。
export const GOAL_CREDIT_ANCHOR = 340;

export async function getBillingConfigPublic(): Promise<BillingConfig> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return BILLING_FALLBACK;
  try {
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    // 视图为「新旧超集」(Paddle 休眠期兼容),只取本类型声明的字段,多余键无害。
    const { data } = await sb.from('billing_config_public').select('*').single();
    return { ...BILLING_FALLBACK, ...(data ?? {}) };
  } catch {
    return BILLING_FALLBACK;
  }
}
