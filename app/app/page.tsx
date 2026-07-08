'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Appbar } from '@/components/appbar';
import { typeTag } from '@/lib/learning-type';
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
  const [loading, setLoading] = useState(true);
  const [spaces, setSpaces] = useState<SpaceCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSpacesOverview().then((r) => {
      setSpaces(r.spaces);
      setError(r.error);
      setLoading(false);
    });
  }, []);

  return (
    <div className="app">
      <Appbar cur="home" />
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
              <small>在电脑上完成入学访谈</small>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
