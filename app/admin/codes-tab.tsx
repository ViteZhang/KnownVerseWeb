'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CODE_PAGE_SIZE,
  FORBIDDEN,
  STATUS_LABEL,
  dateTime,
  fetchCodes,
  fetchCodesSummary,
  voidCode,
  type AdminCode,
  type CodeStatus,
  type CodesSummary,
} from '@/lib/admin';

import s from './admin.module.css';

const n = (v: number | null | undefined) => (v ?? 0).toLocaleString('zh-CN');
const yuan = (v: number | null | undefined) =>
  `¥${(v ?? 0).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}`;

const BADGE: Record<CodeStatus, string> = {
  unused: s.bUnused,
  used: s.bUsed,
  void: s.bVoid,
  expired: s.bExp,
};

const FILTERS: { key: CodeStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'unused', label: '未用' },
  { key: 'used', label: '已用' },
  { key: 'void', label: '已停用' },
];

// 激活码管理(原型 tab 3):汇总条 + 状态/批次/关键词过滤 + 表格 + 作废。
// 状态由服务端推导(未兑=未用 / 已兑=已用 / active=false=已停用 / 过期=已过期),前端只渲染。
export function CodesTab({ toast, refreshKey }: { toast: (m: string) => void; refreshKey: number }) {
  const [status, setStatus] = useState<CodeStatus | 'all'>('all');
  const [batch, setBatch] = useState('all');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<AdminCode[] | null>(null);
  const [summary, setSummary] = useState<CodesSummary | null>(null);
  const [done, setDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [voiding, setVoiding] = useState<string | null>(null);

  const debounced = useDebounced(search, 300);

  const reload = useCallback(async () => {
    setRows(null);
    setDone(false);
    const [list, sum] = await Promise.all([
      fetchCodes({ status, batch, search: debounced }),
      fetchCodesSummary(batch),
    ]);
    const data = list.ok ? list.data : [];
    setRows(data);
    setDone(data.length < CODE_PAGE_SIZE);
    if (sum.ok) setSummary(sum.data);
  }, [status, batch, debounced]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const loadMore = async () => {
    if (!rows || loadingMore) return;
    setLoadingMore(true);
    const r = await fetchCodes({ status, batch, search: debounced, offset: rows.length });
    setLoadingMore(false);
    if (!r.ok) return;
    setRows([...rows, ...r.data]);
    if (r.data.length < CODE_PAGE_SIZE) setDone(true);
  };

  const onVoid = async (code: string) => {
    if (voiding) return;
    setVoiding(code);
    const r = await voidCode(code);
    setVoiding(null);
    if (!r.ok) {
      toast(r.error === FORBIDDEN ? '无权限' : '作废失败,请稍后再试');
      return;
    }
    if (!r.data.ok) {
      // not_voidable = 不存在 / 已兑换 / 已停用。已兑换的码作废无意义,
      // 且用户已到账的积分绝不会被动。
      toast('该码不可作废（已兑换或已停用）');
      await reload();
      return;
    }
    toast(`已作废 ${code}`);
    await reload();
  };

  const batches = summary?.batches ?? [];
  // 选中的批次被删/改名时回落到「全部」,免得下拉停在一个不存在的值上。
  const batchValue = batch === 'all' || batches.includes(batch) ? batch : 'all';

  return (
    <>
      <div className={s.msum}>
        <div className={s.m}>
          <div className={s.k}>已发行</div>
          <div className={s.v}>
            {n(summary?.issued)} <small>张</small>
          </div>
        </div>
        <div className={s.m}>
          <div className={s.k}>已核销</div>
          <div className={s.v}>
            {n(summary?.used)} <small>张 · {n(summary?.used_credits)} 积分</small>
          </div>
        </div>
        <div className={s.m}>
          <div className={s.k}>未兑换沉淀</div>
          <div className={s.v}>
            {n(summary?.unused_credits)} <small>积分待兑</small>
          </div>
        </div>
        <div className={s.m}>
          <div className={s.k}>累计充值流水</div>
          <div className={s.v}>{yuan(summary?.revenue)}</div>
        </div>
      </div>

      <div className={s.toolbar}>
        <div className={s.fchips}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`${s.fchip}${status === f.key ? ` ${s.on}` : ''}`}
              onClick={() => setStatus(f.key)}
            >
              {f.label}
              <span className={s.n}>{n(summary?.by_status?.[f.key])}</span>
            </button>
          ))}
        </div>
        <div className={s.spacer} />
        <select
          className={s.sel}
          value={batchValue}
          onChange={(e) => setBatch(e.target.value)}
          aria-label="批次"
        >
          <option value="all">全部批次</option>
          {batches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <div className={s.search} style={{ flex: '0 0 200px' }}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜码 / 备注"
            aria-label="搜索激活码"
          />
        </div>
      </div>

      <div className={s.tblwrap}>
        <div className={s.scrollx}>
          <table>
            <thead>
              <tr>
                <th>激活码</th>
                <th>面额</th>
                <th className={s.hideSm}>批次</th>
                <th>备注（对账）</th>
                <th>状态</th>
                <th className={s.hideSm}>兑换人 / 时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr>
                  <td className={s.empty} colSpan={7}>
                    正在读取激活码…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className={s.empty} colSpan={7}>
                    没有符合条件的激活码
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.code}>
                    <td className={s.mono} style={{ color: 'var(--ink)', fontWeight: 600 }}>
                      {c.code}
                    </td>
                    <td className={s.num}>
                      {c.credits}{' '}
                      <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>
                        {c.price_cny != null ? yuan(c.price_cny) : '—'}
                      </span>
                    </td>
                    <td className={`${s.hideSm} ${s.mono}`} style={{ color: 'var(--ink-faint)' }}>
                      {c.batch ?? '—'}
                    </td>
                    <td style={{ maxWidth: 180 }}>{c.note ?? '—'}</td>
                    <td>
                      <span className={`${s.badge} ${BADGE[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className={s.hideSm}>
                      {c.redeemed_at ? (
                        <>
                          {c.redeemer || '（未命名）'}
                          <div className={`${s.mail} ${s.mono}`}>{dateTime(c.redeemed_at)}</div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--ink-faint)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <button
                        className={s.lnk}
                        disabled={c.status !== 'unused' || voiding === c.code}
                        onClick={() => onVoid(c.code)}
                      >
                        {voiding === c.code ? '处理中…' : '作废'}
                      </button>
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
        「作废」= 把 <span className={s.mono}>active</span> 置 false,只对未兑换的码可用;
        已兑换的码不受影响,用户到账的积分一分不动。走
        <span className={s.mono}> admin_void_code</span>（is_admin 门禁）。
      </p>
    </>
  );
}

/** 输入防抖:值稳定 delay 毫秒后才向外吐。 */
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
