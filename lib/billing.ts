// 商业化 Phase 3:所有「数字」的前端读取口(《Phase3》§2)。
// 只从 billing_config_public 视图取(积分单价 / 发放量 / price id / 包大小),永不写死这些数字。
// 用无 Cookie 的匿名客户端读,好让定价页保持 SSG/ISR(不被会话 Cookie 拖成动态渲染)。
import { createClient } from '@supabase/supabase-js';

export type BillingConfig = {
  free_monthly_credits: number;
  member_monthly_credits: number;
  cost_unit_generation: number;
  cost_ask_ai: number;
  member_space_cap: number;
  price_pro_yearly: string | null;
  price_pro_monthly: string | null;
  price_credit_pack: string | null;
  price_space_pack: string | null;
  credit_pack_amount: number;
  space_pack_amount: number;
};

// 兜底:视图读不到时用锁定默认值(与 billing_config 表默认一致),定价页永不空白。
export const BILLING_FALLBACK: BillingConfig = {
  free_monthly_credits: 80,
  member_monthly_credits: 800,
  cost_unit_generation: 10,
  cost_ask_ai: 1,
  member_space_cap: 50,
  price_pro_yearly: null,
  price_pro_monthly: null,
  price_credit_pack: null,
  price_space_pack: null,
  credit_pack_amount: 300,
  space_pack_amount: 5,
};

// 展示用美元基准价:Paddle 结算时按地区自动本地化,这里只是营销页示意,非扣款依据。
// (《原型 V1》定价页数字;单次成本标定后若调价,真实价格以 Paddle 后台为准。)
export const DISPLAY_PRICES = {
  proYearly: '$69.99',
  proYearlyPerMonth: '$5.83',
  proMonthly: '$8.99',
  creditPack: '$4.99',
  spacePack: '$6.99',
} as const;

export async function getBillingConfigPublic(): Promise<BillingConfig> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return BILLING_FALLBACK;
  try {
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    const { data } = await sb.from('billing_config_public').select('*').single();
    return { ...BILLING_FALLBACK, ...(data ?? {}) };
  } catch {
    return BILLING_FALLBACK;
  }
}

// 约算:80 积分 ≈ 6 次单元 + 30 次问 AI(示意)。单元 10 / 问 AI 1。
export function estimateUnits(credits: number, cfg: BillingConfig): number {
  return Math.floor((credits * 0.75) / cfg.cost_unit_generation);
}
export function estimateAsks(credits: number, cfg: BillingConfig): number {
  return Math.round((credits * 0.25) / cfg.cost_ask_ai);
}
