// 运营后台数据层(《施工提示词_运营后台_看板与激活码管理_Web版》§5⑤)。
//
// 全部走 admin_* SECURITY DEFINER RPC —— 前端不直连任何表。
// 后台要读的东西(跨用户余额/流水/激活码)现有 RLS 按设计一律不放行,门禁在服务端函数的
// is_admin 判断里;这里用的仍是普通登录态的 anon 客户端,bundle 内绝无 service role key。
import { getSupabase } from '@/lib/supabase/client';

// FORBIDDEN 是非管理员调任一 admin_* 时服务端抛的错(errcode 42501)。
// 上层据此渲染「无权限」,而不是当成网络故障重试。
export const FORBIDDEN = 'forbidden';

export type AdminError = typeof FORBIDDEN | 'network';

function classify(error: { message?: string; code?: string } | null): AdminError {
  const msg = error?.message ?? '';
  if (error?.code === '42501' || /FORBIDDEN|permission denied/i.test(msg)) return FORBIDDEN;
  return 'network';
}

export type AdminResult<T> = { ok: true; data: T } | { ok: false; error: AdminError };

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<AdminResult<T>> {
  try {
    const { data, error } = await getSupabase().rpc(fn, args);
    if (error) return { ok: false, error: classify(error) };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: 'network' };
  }
}

// ── 面额报价单(前端常量,非 billing_config)────────────────────────────
// 系统里只有「激活码面额」;¥ 价是线下微信报价与对账口径,生成时作为 price_cny 带入。
// 与 lib/billing.ts 的 CREDIT_PACKS 同源,标定前不对外调整。
export type Denom = { credits: number; price: number; label: string };
export const DENOMS: Denom[] = [
  { credits: 300, price: 9.9, label: '¥9.9' },
  { credits: 1000, price: 29.9, label: '¥29.9' },
  { credits: 2500, price: 68, label: '¥68' },
];

// ── ① 用量看板 ────────────────────────────────────────────────────────

export type DashboardStats = {
  total_users: number;
  new_users_7d: number;
  active_learners_7d: number;
  month_spend: number;
  codes_redeemed_total: number;
  credits_redeemed_total: number;
  revenue_total: number;
  redeemed_7d: number; // 退出线①:每周核销 > 10 笔
  revenue_month: number; // 退出线②:月流水 > ¥3000
};

export function fetchDashboardStats() {
  return call<DashboardStats>('admin_dashboard_stats');
}

// 退出线阈值(《施工提示词》§0):任一触线 → 该把人肉充值换成正式支付了。
export const EXIT_LINE = { redeemedPerWeek: 10, revenuePerMonth: 3000 };

export type AdminUser = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  free_balance: number;
  paid_balance: number;
  spaces_count: number;
  total_spend: number;
  invites_count: number;
  last_active_at: string | null;
  created_at: string;
};

export type UserSort = 'active' | 'spend' | 'paid' | 'reg';
export const USER_PAGE_SIZE = 50;

export function fetchUsers(opts: {
  search?: string;
  sort?: UserSort;
  limit?: number;
  offset?: number;
}) {
  return call<AdminUser[]>('admin_list_users', {
    p_search: opts.search?.trim() || null,
    p_sort: opts.sort ?? 'active',
    p_limit: opts.limit ?? USER_PAGE_SIZE,
    p_offset: opts.offset ?? 0,
  });
}

export type AdminLedgerRow = {
  delta: number;
  reason: string;
  balance_after: number | null;
  created_at: string;
};

export function fetchUserLedger(userId: string, limit = 50) {
  return call<AdminLedgerRow[]>('admin_user_ledger', { p_user_id: userId, p_limit: limit });
}

// ── ② 生成激活码 ──────────────────────────────────────────────────────

// price 留空 = 活动码/白嫖码,不计入营收流水。
export function generateCodes(opts: {
  count: number;
  credits: number;
  batch?: string | null;
  note?: string | null;
  price?: number | null;
}) {
  return call<{ code: string }[]>('admin_generate_codes', {
    p_count: opts.count,
    p_credits: opts.credits,
    p_batch: opts.batch?.trim() || null,
    p_note: opts.note?.trim() || null,
    p_price_cny: opts.price ?? null,
  });
}

// ── ③ 激活码管理 ──────────────────────────────────────────────────────

export type CodeStatus = 'unused' | 'used' | 'void' | 'expired';

export type AdminCode = {
  code: string;
  credits: number;
  price_cny: number | null;
  batch: string | null;
  note: string | null;
  status: CodeStatus;
  redeemer: string | null;
  redeemed_at: string | null;
  created_at: string;
};

export type CodesSummary = {
  issued: number;
  used: number;
  used_credits: number;
  unused_credits: number;
  revenue: number;
  by_status: Record<'all' | CodeStatus, number>;
  batches: string[];
};

export const CODE_PAGE_SIZE = 100;

export function fetchCodes(opts: {
  status?: CodeStatus | 'all';
  batch?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  return call<AdminCode[]>('admin_list_codes', {
    p_status: opts.status ?? 'all',
    p_batch: opts.batch ?? 'all',
    p_search: opts.search?.trim() || null,
    p_limit: opts.limit ?? CODE_PAGE_SIZE,
    p_offset: opts.offset ?? 0,
  });
}

export function fetchCodesSummary(batch = 'all') {
  return call<CodesSummary>('admin_codes_summary', { p_batch: batch });
}

// 只对未兑换的码生效;已兑换 / 已停用 / 不存在一律返回 not_voidable,
// 且用户已到账的积分绝不受影响(作废只是把 active 置 false)。
export function voidCode(code: string) {
  return call<{ ok: boolean; reason?: string }>('admin_void_code', { p_code: code });
}

// ── 展示辅助 ──────────────────────────────────────────────────────────

// 流水 reason → 人话。与 lib/credits.ts 的 REASON_LABEL 同表(后台多一个管理员视角的兜底)。
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

export const STATUS_LABEL: Record<CodeStatus, string> = {
  unused: '未用',
  used: '已用',
  void: '已停用',
  expired: '已过期',
};

/** 「2 小时前 / 昨天 / 07-08」——看板列表用的粗粒度相对时间。 */
export function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)} 小时前`;
  const days = Math.floor(mins / (60 * 24));
  if (days === 1) return '昨天';
  if (days < 30) return `${days} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

/** 「07-08」——注册日等只需月日的场合。 */
export function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

/** 「07-08 21:14」——兑换时间等需要到分钟的场合。 */
export function dateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
