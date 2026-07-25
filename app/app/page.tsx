'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Appbar } from '@/components/appbar';
import { Checkin } from '@/components/paywall/checkin';
import { usePaywall } from '@/components/paywall/paywall-provider';
import { typeTag } from '@/lib/learning-type';
import { applyPendingReferral } from '@/lib/referral';
import { fetchSpacesOverview } from '@/lib/spaces';
import type { SpaceCard } from '@/lib/types';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

export default function HomePage() {
  const { refreshCredits } = usePaywall();
  const [loading, setLoading] = useState(true);
  const [spaces, setSpaces] = useState<SpaceCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  // 邀请码应用成功的轻提示（§6.2），3s 自动消失。
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // 登录后应用暂存的邀请码一次（§6.2）。幂等；成功才轻提示，无效/已邀过静默。
    (async () => {
      const applied = await applyPendingReferral();
      const r = await fetchSpacesOverview();
      if (!alive) return;
      setSpaces(r.spaces);
      setError(r.error);
      setLoading(false);
      if (applied?.applied) {
        // 纯积分制:邀请奖励改为送积分,提示到账并刷新余额条。
        refreshCredits();
        setToast(`已为你和邀请人各 +${applied.credits ?? 50} 积分`);
        setTimeout(() => alive && setToast(null), 3000);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshCredits]);

  return (
    <div className="app">
      <Appbar cur="home" />
      {toast && <div className="toast">{toast}</div>}
      <div className="home-wrap">
        <div className="home-hd">
          <div className="greet">
            {greeting()}
            <small>
              {spaces.length > 0
                ? `${spaces.length} 个空间在等你，挑一个继续`
                : '在电脑上继续你手机里的学习'}
            </small>
          </div>
        </div>

        <Checkin />

        <div className="section-label">学习空间</div>

        {loading ? (
          <div className="center-state">
            <div className="ring" />
            <div className="st-text">正在读取你的学习空间…</div>
          </div>
        ) : error ? (
          <div className="center-state">
            <div className="st-title">读取出错</div>
            <div className="st-text">{error}</div>
          </div>
        ) : (
          <div className="grid">
            {spaces.map((s) => {
              const tag = typeTag(s.learningType);
              const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
              return (
                <Link key={s.id} href={`/app/space/${s.id}`} className="space-card">
                  <div className="row1">
                    <div className="nm">{s.name}</div>
                    <span className={`tag ${tag.cls}`}>{tag.label}</span>
                  </div>
                  <div className="sub">
                    {s.total} 个单元 · 已完成 {s.done}
                  </div>
                  <div className="prog">
                    <div className="bar">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                    <span className="n">{pct}%</span>
                  </div>
                  <div className="resume">
                    <span className="dot" />
                    <span className="txt">
                      {s.finished ? (
                        <b>已学完整个空间 🎉</b>
                      ) : (
                        <>
                          继续 · <b>{s.nextUnitTitle ?? '开始学习'}</b>
                        </>
                      )}
                    </span>
                    <span className="go">{s.finished ? '回顾 →' : '继续学习 →'}</span>
                  </div>
                </Link>
              );
            })}

            <Link href="/app/new" className="newspace" style={{ cursor: 'pointer' }}>
              <div className="plus">＋</div>
              <div>新建学习空间</div>
              <span className="ns-cost">−50 积分</span>
            </Link>
          </div>
        )}

        {!loading && !error && (
          <div className="home-hint">
            积分只花在三处:<b>建空间 50</b> · <b>生成单元 10</b> · <b>问 AI 1</b>。阅读、提问记录、学习档案都不花积分。
          </div>
        )}
      </div>
    </div>
  );
}
