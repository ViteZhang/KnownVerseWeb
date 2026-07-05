'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Appbar } from '@/components/appbar';
import { typeTag } from '@/lib/learning-type';
import { fetchReadingProgress } from '@/lib/reading-progress';
import { computePhaseStatuses, fetchSpacePath, findNextUnit } from '@/lib/spaces';
import type { ComputedPhase, SpacePath } from '@/lib/types';

function statusPill(status: string): { cls: string; label: string } {
  if (status === 'done') return { cls: 'done', label: '已完成' };
  if (status === 'learning') return { cls: 'learning', label: '学习中' };
  return { cls: 'todo', label: '未生成' };
}

export default function PathPage({ params }: { params: { id: string } }) {
  const spaceId = params.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SpacePath | null>(null);
  const [resumeUnitId, setResumeUnitId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchSpacePath(spaceId), fetchReadingProgress(spaceId)]).then(
      ([path, prog]) => {
        setData(path);
        // 断点优先用 reading_progress 记录的单元，否则首个未完成单元。
        const next = findNextUnit(path.phases);
        setResumeUnitId(prog?.unit_id ?? next?.id ?? null);
        setLoading(false);
      },
    );
  }, [spaceId]);

  const computed: ComputedPhase[] = useMemo(
    () => (data ? computePhaseStatuses(data.phases) : []),
    [data],
  );

  const { total, done, nextUnit } = useMemo(() => {
    if (!data) return { total: 0, done: 0, nextUnit: null };
    const t = data.phases.reduce((n, p) => n + p.units.length, 0);
    const d = data.phases.reduce(
      (n, p) => n + p.units.filter((u) => u.status === 'done').length,
      0,
    );
    return { total: t, done: d, nextUnit: findNextUnit(data.phases) };
  }, [data]);

  if (loading) {
    return (
      <div className="app">
        <Appbar cur="path" spaceId={spaceId} />
        <div className="center-state">
          <div className="ring" />
          <div className="st-text">正在读取学习路径…</div>
        </div>
      </div>
    );
  }

  if (!data?.space) {
    return (
      <div className="app">
        <Appbar cur="home" />
        <div className="center-state">
          <div className="st-title">找不到这个空间</div>
          <div className="st-text">{data?.error ?? '它可能不属于当前账号。'}</div>
          <Link className="ghost" href="/" style={{ marginTop: 8 }}>
            ← 回到我的空间
          </Link>
        </div>
      </div>
    );
  }

  const tag = typeTag(data.space.learning_type);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const resumeTitle =
    nextUnit?.title ??
    data.phases.flatMap((p) => p.units).find((u) => u.id === resumeUnitId)?.title ??
    '开始学习';

  const openUnit = (unitId: string) =>
    router.push(`/space/${spaceId}/unit/${unitId}`);

  return (
    <div className="app">
      <Appbar cur="path" spaceId={spaceId} />
      <div className="path-grid">
        <div>
          <div className="path-head">
            <Link className="crumb" href="/">
              ← 我的空间
            </Link>
            <h1>{data.space.name}</h1>
            <div className="meta">
              <span className={`tag ${tag.cls}`}>{tag.label}</span>
              <span>·</span>
              <span>
                {data.phases.length} 个阶段 · 共 {total} 单元
              </span>
            </div>
            <div className="overall">
              <div className="bar">
                <i style={{ width: `${pct}%` }} />
              </div>
              <span className="pct">{pct}%</span>
            </div>
          </div>

          {computed.map((p) => {
            const phaseDone = p.units.filter((u) => u.status === 'done').length;
            const locked = p.computed === 'locked';
            return (
              <div className="phase" key={p.id}>
                <div className="phase-h">
                  <span className="idx">{p.idx}</span>
                  <span className="pt">{p.title}</span>
                  <span className="ps">
                    {phaseDone} / {p.units.length}
                    {locked ? ' · 未解锁' : ''}
                  </span>
                </div>
                <div className="units">
                  {p.units.map((u) => {
                    const pill = statusPill(u.status);
                    const isCur = !locked && u.id === nextUnit?.id;
                    const cls = [
                      'unit',
                      u.status === 'done' ? 'done' : '',
                      isCur ? 'cur' : '',
                      locked ? 'locked' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <div
                        key={u.id}
                        className={cls}
                        onClick={locked ? undefined : () => openUnit(u.id)}
                      >
                        <div style={{ flex: 1 }}>
                          <div className="ut">{u.title}</div>
                          {isCur && <div className="us">上次学到这里 · 继续</div>}
                        </div>
                        <span className={`st ${pill.cls}`}>{pill.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="side">
          {resumeUnitId && (
            <Link className="resume-hero" href={`/space/${spaceId}/unit/${resumeUnitId}`}>
              <small>继续学习</small>
              <div className="ru">{resumeTitle}</div>
              <div className="rgo">回到上次进度 →</div>
            </Link>
          )}
          <div className="minicard">
            <div className="h">本空间</div>
            <Link
              className="minirow"
              href={`/space/${spaceId}/questions`}
              style={{ textDecoration: 'none' }}
            >
              <span className="mi">
                <svg viewBox="0 0 24 24">
                  <path d="M8 10h8M8 14h5" />
                  <path d="M21 12a9 9 0 1 1-3.5-7.1L21 5" />
                </svg>
              </span>
              <span className="ml">提问记录</span>
              <span className="mc">›</span>
            </Link>
            <div className="minirow" style={{ cursor: 'default' }}>
              <span className="mi">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
                </svg>
              </span>
              <span className="ml">关于我 · 记忆</span>
              <span className="mc">Phase 2</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
