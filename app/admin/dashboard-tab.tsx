'use client';
import { useEffect, useRef, useState } from 'react';

import {
  EXIT_LINE,
  REASON_LABEL,
  USER_PAGE_SIZE,
  dateTime,
  fetchUserLedger,
  fetchUsers,
  relativeTime,
  shortDate,
  type AdminLedgerRow,
  type AdminUser,
  type DashboardStats,
  type UserSort,
} from '@/lib/admin';

import s from './admin.module.css';

const n = (v: number | null | undefined) => (v ?? 0).toLocaleString('zh-CN');
const yuan = (v: number | null | undefined) =>
  `¥${(v ?? 0).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}`;

/** 退出线进度条:越接近阈值越烫。sage → amber(60%) → danger(90%)。 */
function ExitBar({ label, value, cap, format }: {
  label: string;
  value: number;
  cap: number;
  format: (v: number) => string;
}) {
  const pct = Math.min(100, cap > 0 ? (value / cap) * 100 : 0);
  const tone = pct >= 90 ? s.hot : pct >= 60 ? s.warn : '';
  return (
    <div className={s.grow}>
      <div className={s.lab}>
        <span>{label}</span>
        <span className={s.r}>
          <b className={s.tabnum}>{format(value)}</b> / {format(cap)}
        </span>
      </div>
      <div className={s.gtrack}>
        <div className={`${s.gfill} ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// 用量看板(原型 tab 1):顶部四卡 + 退出线监控 + 用户表 + 单用户流水抽屉。
// 所有数字来自 admin_dashboard_stats / admin_list_users / admin_user_ledger,无一写死。
export function DashboardTab({ stats }: { stats: DashboardStats | null }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<UserSort>('active');
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);

  const [sel, setSel] = useState<AdminUser | null>(null);
  const [ledger, setLedger] = useState<AdminLedgerRow[] | null>(null);

  // 搜索防抖 300ms:每敲一个字都打一次跨用户聚合查询太贵。
  const debounced = useDebounced(search, 300);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setDone(false);
    fetchUsers({ search: debounced, sort }).then((r) => {
      if (!alive) return;
      const list = r.ok ? r.data : [];
      setRows(list);
      setDone(list.length < USER_PAGE_SIZE);
    });
    return () => {
      alive = false;
    };
  }, [debounced, sort]);

  const loadMore = async () => {
    if (!rows || loadingMore) return;
    setLoadingMore(true);
    const r = await fetchUsers({ search: debounced, sort, offset: rows.length });
    setLoadingMore(false);
    if (!r.ok) return;
    setRows([...rows, ...r.data]);
    if (r.data.length < USER_PAGE_SIZE) setDone(true);
  };

  const openDrawer = async (u: AdminUser) => {
    setSel(u);
    setLedger(null);
    const r = await fetchUserLedger(u.user_id);
    setLedger(r.ok ? r.data : []);
  };
  const closeDrawer = () => setSel(null);

  // Esc 关抽屉 —— 抽屉是覆盖层,键盘用户得有出路。
  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel]);

  const activeRate =
    stats && stats.total_users > 0
      ? Math.round((stats.active_learners_7d / stats.total_users) * 100)
      : 0;
  const perUserSpend =
    stats && stats.total_users > 0 ? Math.round(stats.month_spend / stats.total_users) : 0;

  return (
    <>
      <div className={s.stats}>
        <div className={s.stat}>
          <div className={s.k}>总用户</div>
          <div className={s.v}>{n(stats?.total_users)}</div>
          <div className={s.s}>
            本周新增 <b>+{n(stats?.new_users_7d)}</b>
          </div>
        </div>
        <div className={s.stat}>
          <div className={s.k}>本周活跃学习者</div>
          <div className={s.v}>{n(stats?.active_learners_7d)}</div>
          <div className={s.s}>active_learning · 占比 {activeRate}%</div>
        </div>
        <div className={`${s.stat} ${s.accent}`}>
          <div className={s.k}>本月消耗积分</div>
          <div className={s.v}>{n(stats?.month_spend)}</div>
          <div className={s.s}>免费池成本闸 · 人均 {n(perUserSpend)}</div>
        </div>
        <div className={s.stat}>
          <div className={s.k}>累计激活码核销</div>
          <div className={s.v}>{n(stats?.codes_redeemed_total)}</div>
          <div className={s.s}>
            回收 <b>{n(stats?.credits_redeemed_total)}</b> 积分 · {yuan(stats?.revenue_total)}
          </div>
        </div>
      </div>

      <div className={s.health}>
        <div className={s.top}>
          <h3>运营健康 · 退出线监控</h3>
          <span className={s.hint}>
            每周核销 &gt; {EXIT_LINE.redeemedPerWeek} 笔 或 月流水 &gt; ¥
            {EXIT_LINE.revenuePerMonth} → 该启动正式支付了,别让人肉充值吃掉半年
          </span>
        </div>
        <div className={s.rows}>
          <ExitBar
            label="本周核销笔数"
            value={stats?.redeemed_7d ?? 0}
            cap={EXIT_LINE.redeemedPerWeek}
            format={(v) => `${n(v)} 笔`}
          />
          <ExitBar
            label="本月充值流水"
            value={stats?.revenue_month ?? 0}
            cap={EXIT_LINE.revenuePerMonth}
            format={yuan}
          />
        </div>
      </div>

      <div className={s.toolbar}>
        <div className={s.search}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜昵称 / 邮箱"
            aria-label="搜索用户"
          />
        </div>
        <select
          className={s.sel}
          value={sort}
          onChange={(e) => setSort(e.target.value as UserSort)}
          aria-label="排序方式"
        >
          <option value="active">按最近活跃</option>
          <option value="spend">按累计消耗</option>
          <option value="paid">按充值余额</option>
          <option value="reg">按注册时间</option>
        </select>
      </div>

      <div className={s.tblwrap}>
        <div className={s.scrollx}>
          <table>
            <thead>
              <tr>
                <th>用户</th>
                <th>余额（免/充）</th>
                <th>空间</th>
                <th>累计消耗</th>
                <th className={s.hideSm}>邀请</th>
                <th>最近活跃</th>
                <th className={s.hideSm}>注册</th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr>
                  <td className={s.empty} colSpan={7}>
                    正在读取用户…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className={s.empty} colSpan={7}>
                    没有符合条件的用户
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr
                    key={u.user_id}
                    className={s.click}
                    onClick={() => openDrawer(u)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDrawer(u);
                      }
                    }}
                  >
                    <td>
                      <div className={s.name}>{u.display_name || '（未命名）'}</div>
                      <div className={`${s.mail} ${s.mono}`}>{u.email ?? '—'}</div>
                    </td>
                    <td>
                      <div className={s.coinpair}>
                        <span className={s.chipF}>免 {u.free_balance}</span>
                        <span className={s.chipP}>充 {u.paid_balance}</span>
                      </div>
                    </td>
                    <td className={s.num}>{u.spaces_count}</td>
                    <td className={s.num}>{n(u.total_spend)}</td>
                    <td className={`${s.hideSm} ${s.num}`}>{u.invites_count}</td>
                    <td>{relativeTime(u.last_active_at)}</td>
                    <td className={s.hideSm} style={{ color: 'var(--ink-faint)' }}>
                      {shortDate(u.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {rows && rows.length > 0 && !done && (
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <button className={`${s.btn} ${s.ghost}`} onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? '加载中…' : '加载更多'}
          </button>
        </div>
      )}

      <p className={s.hintline} style={{ marginTop: 10 }}>
        点任一行看该用户的积分流水（credit_ledger）。跨用户读取一律走带 is_admin 门禁的
        SECURITY DEFINER RPC;普通登录用户对这些表按 RLS 只能读自己。
      </p>

      {/* ── 单用户抽屉 ── */}
      <button
        className={`${s.scrim}${sel ? ` ${s.on}` : ''}`}
        onClick={closeDrawer}
        aria-label="关闭"
        tabIndex={sel ? 0 : -1}
      />
      <aside className={`${s.drawer}${sel ? ` ${s.on}` : ''}`} aria-hidden={!sel}>
        {sel && (
          <>
            <div className={s.dhead}>
              <div className={s.row}>
                <div className={s.av}>
                  {(sel.display_name || sel.email || '·')[0].toUpperCase()}
                </div>
                <div>
                  <div className={s.nm}>{sel.display_name || '（未命名）'}</div>
                  <div className={s.em}>{sel.email ?? '—'}</div>
                </div>
                <button className={s.dclose} onClick={closeDrawer} aria-label="关闭抽屉">
                  ×
                </button>
              </div>
              <div className={s.dmeta}>
                <div className={s.mi}>
                  <div className={s.k}>免费桶 free_balance</div>
                  <div className={s.v}>{n(sel.free_balance)}</div>
                </div>
                <div className={s.mi}>
                  <div className={s.k}>充值桶 paid_balance</div>
                  <div className={s.v}>{n(sel.paid_balance)}</div>
                </div>
                <div className={s.mi}>
                  <div className={s.k}>学习空间</div>
                  <div className={s.v}>{sel.spaces_count}</div>
                </div>
                <div className={s.mi}>
                  <div className={s.k}>累计消耗</div>
                  <div className={s.v}>{n(sel.total_spend)}</div>
                </div>
              </div>
            </div>
            <div className={s.dbody}>
              <h4>积分流水 credit_ledger</h4>
              {ledger === null ? (
                <div className={s.hintline}>正在读取流水…</div>
              ) : ledger.length === 0 ? (
                <div className={s.hintline}>该用户还没有任何积分记录。</div>
              ) : (
                ledger.map((l, i) => (
                  <div className={s.led} key={`${l.created_at}-${i}`}>
                    <div>
                      <div className={s.lt}>{REASON_LABEL[l.reason] ?? l.reason}</div>
                      <div className={`${s.ld} ${s.mono}`}>
                        {l.reason} · {dateTime(l.created_at)}
                        {l.balance_after != null ? ` · 余 ${l.balance_after}` : ''}
                      </div>
                    </div>
                    <div className={`${s.amt} ${l.delta > 0 ? s.plus : s.minus}`}>
                      {l.delta > 0 ? '+' : ''}
                      {l.delta}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

/** 输入防抖:值稳定 delay 毫秒后才向外吐,用来省掉每次击键一个查询。 */
function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  const ref = useRef(value);
  ref.current = value;
  useEffect(() => {
    const t = setTimeout(() => setV(ref.current), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
