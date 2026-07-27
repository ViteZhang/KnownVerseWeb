'use client';
import { useState } from 'react';

import { DENOMS, generateCodes, FORBIDDEN } from '@/lib/admin';

import s from './admin.module.css';

/** 默认批次 = 当前年月(2026-07),对账时天然按月归堆。 */
function currentBatch(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// 生成激活码(原型 tab 2)。
// 标准档把对应 ¥ 价作为 price_cny 带入 → ¥流水天然只统计真金白银;
// 自定义档价格留空 = 活动码/白嫖码,不计入营收。
export function GenerateTab({
  toast,
  onGenerated,
}: {
  toast: (m: string) => void;
  onGenerated: () => void;
}) {
  const [denom, setDenom] = useState<number | 'custom'>(DENOMS[0].credits);
  const [customCredits, setCustomCredits] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [count, setCount] = useState('10');
  const [batch, setBatch] = useState(currentBatch());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ codes: string[]; credits: number; batch: string } | null>(
    null,
  );

  const onSubmit = async () => {
    if (busy) return;
    const credits = denom === 'custom' ? parseInt(customCredits, 10) : denom;
    const c = parseInt(count, 10);
    if (!credits || credits < 1) {
      toast('请填写有效面额');
      return;
    }
    if (!c || c < 1 || c > 200) {
      toast('数量需在 1–200 之间');
      return;
    }
    // 标准档用报价单的价;自定义档留空 = 不计营收。
    const price =
      denom === 'custom'
        ? customPrice.trim()
          ? Number(customPrice)
          : null
        : (DENOMS.find((d) => d.credits === denom)?.price ?? null);
    if (price !== null && (Number.isNaN(price) || price < 0)) {
      toast('价格填得不对');
      return;
    }

    setBusy(true);
    const r = await generateCodes({ count: c, credits, batch, note, price });
    setBusy(false);

    if (!r.ok) {
      toast(r.error === FORBIDDEN ? '无权限,生成被拒绝' : '生成失败,请稍后再试');
      return;
    }
    const codes = r.data.map((x) => x.code);
    setFresh({ codes, credits, batch: batch.trim() || '未分批' });
    onGenerated();
    toast(`已生成 ${codes.length} 张激活码`);
  };

  return (
    <div className={s.gengrid}>
      <div className={s.card}>
        <div className={s.field}>
          <label>面额</label>
          <div className={s.denoms}>
            {DENOMS.map((d) => (
              <button
                key={d.credits}
                type="button"
                className={`${s.denom}${denom === d.credits ? ` ${s.on}` : ''}`}
                onClick={() => setDenom(d.credits)}
              >
                <div className={s.c}>{d.credits}</div>
                <div className={s.y}>{d.label}</div>
              </button>
            ))}
            <button
              type="button"
              className={`${s.denom}${denom === 'custom' ? ` ${s.on}` : ''}`}
              onClick={() => setDenom('custom')}
            >
              <div className={s.c}>自定义</div>
              <div className={s.y}>其他面额</div>
            </button>
          </div>
          {denom === 'custom' && (
            <>
              <input
                className={`${s.inp} ${s.mono}`}
                style={{ marginTop: 10 }}
                value={customCredits}
                onChange={(e) => setCustomCredits(e.target.value)}
                placeholder="自定义积分数,如 500"
                inputMode="numeric"
              />
              <input
                className={`${s.inp} ${s.mono}`}
                style={{ marginTop: 8 }}
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="售价 ¥（留空 = 活动码,不计入营收）"
                inputMode="decimal"
              />
            </>
          )}
        </div>

        <div className={s.field}>
          <label>生成数量</label>
          <input
            className={`${s.inp} ${s.mono}`}
            type="number"
            min={1}
            max={200}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
          <p className={s.hintline}>
            单次最多 200 张。KV-XXXX-XXXX-XXXX 格式,32 字母表（剔除 0 O 1 I L）,微信里好手打。
          </p>
        </div>

        <div className={s.field}>
          <label>
            批次 batch <span className={s.sub}>（按批统计、对账用）</span>
          </label>
          <input
            className={`${s.inp} ${s.mono}`}
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            placeholder={currentBatch()}
          />
        </div>

        <div className={s.field}>
          <label>
            备注 note <span className={s.sub}>（写清对应谁的哪笔转账）</span>
          </label>
          <input
            className={s.inp}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="如：小红书活动 / 微信 xxx 转账 ¥29.9"
          />
        </div>

        <button className={`${s.btn} ${s.primary}`} onClick={onSubmit} disabled={busy}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {busy ? '生成中…' : '生成激活码'}
        </button>

        <div className={s.warnbox}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
          <p>
            <b>安全边界：</b>生成走服务端 <span className={s.mono}>admin_generate_codes</span>
            （包装 <span className={s.mono}>generate_credit_codes</span>,函数内 is_admin 硬门禁）；
            普通登录用户对该函数与 <span className={s.mono}>credit_codes</span> 表
            <b>完全无权限</b>,防拖库枚举未使用的码。
          </p>
        </div>
      </div>

      <div className={s.card}>
        {!fresh ? (
          <div className={`${s.result} ${s.emptyState}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="8" width="18" height="12" rx="2" />
              <path d="M7 8V6a5 5 0 0 1 10 0v2" />
            </svg>
            <div style={{ fontSize: 13 }}>生成的激活码会出现在这里</div>
            <div style={{ fontSize: 11.5 }}>左侧填好面额、数量、批次、备注</div>
          </div>
        ) : (
          <div className={s.result}>
            <div className={s.rsum}>
              <div className={s.t}>
                生成 <b>{fresh.codes.length}</b> 张 · 面额 {fresh.credits} · 批次 {fresh.batch}
              </div>
              <button
                className={`${s.btn} ${s.ghost}`}
                onClick={async () => {
                  const ok = await copy(fresh.codes.join('\n'));
                  toast(ok ? `已复制 ${fresh.codes.length} 张` : '复制失败,请手动选中');
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                </svg>
                复制全部
              </button>
            </div>
            <div className={s.codelist}>
              {fresh.codes.map((c) => (
                <div className={s.codeitem} key={c}>
                  <span>{c}</span>
                  <button
                    className={`${s.lnk} ${s.copy}`}
                    onClick={async () => {
                      const ok = await copy(c);
                      toast(ok ? `已复制 ${c}` : '复制失败,请手动选中');
                    }}
                  >
                    复制
                  </button>
                </div>
              ))}
            </div>
            <p className={s.hintline}>
              这些码已写入 <span className={s.mono}>credit_codes</span>,切到「激活码管理」即可看到,
              处于「未用」态。发码时记得在备注里对上买家。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
