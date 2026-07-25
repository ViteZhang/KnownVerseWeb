'use client';
import { useEffect, useState } from 'react';

import { Appbar } from '@/components/appbar';
import { usePaywall } from '@/components/paywall/paywall-provider';
import { fetchLedger, REASON_LABEL, type LedgerRow } from '@/lib/credits';

// 积分流水页(《终版》§8⑤)。信任基建:一张流水消掉绝大部分「我的积分怎么少了」的私信。
// 底部固定说明:先扣免费、后扣充值,你花钱买的永远最后被动用。
export default function LedgerPage() {
  const { credits } = usePaywall();
  const [rows, setRows] = useState<LedgerRow[] | null>(null);

  useEffect(() => {
    fetchLedger().then(setRows);
  }, []);

  return (
    <div className="app">
      <Appbar cur="home" />
      <div className="ledger">
        <div className="lg-hd">
          <h2>积分流水</h2>
          {credits && (
            <span className="lg-sum">
              免费额度 <b>{credits.free}</b>/{credits.freeCap} · 充值额度 <b>{credits.paid}</b>
            </span>
          )}
        </div>

        {rows === null ? (
          <div className="center-state">
            <div className="ring" />
            <div className="st-text">正在读取流水…</div>
          </div>
        ) : rows.length === 0 ? (
          <div className="center-state">
            <div className="st-text">还没有任何积分记录。</div>
          </div>
        ) : (
          <div className="lg-list">
            {rows.map((r) => {
              const plus = r.delta > 0;
              return (
                <div className="lg-row" key={r.id}>
                  <div className={`lg-i ${plus ? 'plus' : 'minus'}`}>{plus ? '↑' : '↓'}</div>
                  <div className="lg-t">
                    <div className="t">{REASON_LABEL[r.reason] ?? r.reason}</div>
                    <div className="d">{new Date(r.created_at).toLocaleString('zh-CN')}</div>
                  </div>
                  <div className={`lg-v ${plus ? 'plus' : 'minus'}`}>
                    {plus ? '+' : ''}
                    {r.delta}
                  </div>
                  <div className="lg-b">{r.balance_after != null ? `余 ${r.balance_after}` : ''}</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="hintbox" style={{ marginTop: 20 }}>
          消耗时<b>先扣免费额度、后扣充值额度</b> —— 你花钱买的积分永远最后被动用,而且不会过期。
        </div>
      </div>
    </div>
  );
}
