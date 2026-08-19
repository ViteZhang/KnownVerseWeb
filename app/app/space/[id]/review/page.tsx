'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Appbar } from '@/components/appbar';
import { usePaywall } from '@/components/paywall/paywall-provider';
import { BILLING_FALLBACK, getBillingConfigPublic } from '@/lib/billing';
import { getCreditStatus, newIdemSuffix, spendSpaceSummary } from '@/lib/credits';
import { fetchQuestions } from '@/lib/questions';
import { fetchSpacePath } from '@/lib/spaces';
import {
  buildSpaceDigest,
  fetchLatestSummary,
  fetchSpaceContents,
  generateSpaceSummary,
  saveSummary,
} from '@/lib/summary';
import type { ContentBlock, PhaseWithUnits, SpaceSummary } from '@/lib/types';

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ReviewPage({ params }: { params: { id: string } }) {
  const spaceId = params.id;
  const { openCreditWall, refreshCredits } = usePaywall();

  const [loading, setLoading] = useState(true);
  const [spaceName, setSpaceName] = useState('');
  const [learningType, setLearningType] = useState('');
  const [phases, setPhases] = useState<PhaseWithUnits[]>([]);
  const [contents, setContents] = useState<Map<string, ContentBlock[] | null>>(new Map());
  const [questions, setQuestions] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 已保存的那份总结（有就先看缓存，不花积分）。
  const [summary, setSummary] = useState<SpaceSummary | null>(null);
  // 本次刚生成、但没能落库的正文（表还没建时用，刷新即失）。
  const [draft, setDraft] = useState<string | null>(null);
  const [draftAt, setDraftAt] = useState<string | null>(null);
  const [storeMissing, setStoreMissing] = useState(false);

  const [busy, setBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [chargeNote, setChargeNote] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busyRef = useRef(false);

  const [cost, setCost] = useState(BILLING_FALLBACK.cost_space_summary);
  const costRef = useRef(cost);
  useEffect(() => {
    getBillingConfigPublic().then((c) => {
      setCost(c.cost_space_summary);
      costRef.current = c.cost_space_summary;
    });
  }, []);

  // ── 载入原料 ──────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchSpacePath(spaceId),
      fetchSpaceContents(spaceId),
      fetchQuestions(spaceId),
      fetchLatestSummary(spaceId),
    ]).then(([path, cts, qs, latest]) => {
      if (!alive) return;
      setSpaceName(path.space?.name ?? '');
      setLearningType(path.space?.learning_type ?? '');
      setPhases(path.phases);
      setContents(cts.contents);
      setQuestions(qs.rows.map((r) => r.question));
      setSummary(latest.row);
      setStoreMissing(latest.missing);
      setLoadError(path.error ?? cts.error ?? latest.error);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [spaceId]);

  const stats = useMemo(() => {
    const all = phases.flatMap((p) => p.units);
    const generated = all.filter((u) => (contents.get(u.id) ?? null) !== null);
    return {
      total: all.length,
      done: all.filter((u) => u.status === 'done').length,
      generated: generated.length,
      anchorUnitId: all[0]?.id ?? null,
    };
  }, [phases, contents]);

  // 缓存里的总结是在多少进度上写的 —— 之后又学了新单元就提示可以重写。
  const stale = useMemo(() => {
    if (!summary) return false;
    return (summary.unit_done ?? 0) < stats.done;
  }, [summary, stats.done]);

  const shown = draft ?? summary?.content ?? null;
  const shownAt = draft ? draftAt : (summary?.created_at ?? null);

  // ── 生成 ──────────────────────────────────────────────────────────
  const run = useCallback(async () => {
    if (busyRef.current) return;
    if (!stats.anchorUnitId || stats.generated === 0) {
      setGenError('这个空间还没有已生成的单元内容，先学几个单元再来复盘。');
      return;
    }
    const price = costRef.current;
    busyRef.current = true;
    setBusy(true);
    setGenError(null);
    setChargeNote(null);

    // 先看余额够不够总价，不够直接弹积分墙，不白跑一趟 LLM。
    const st = await getCreditStatus();
    if (st && st.balance < price) {
      busyRef.current = false;
      setBusy(false);
      openCreditWall({ balance: st.balance, needed: price });
      return;
    }

    const digest = buildSpaceDigest({
      spaceName,
      learningType,
      phases,
      contents,
      questions,
    });
    const r = await generateSpaceSummary(spaceId, stats.anchorUnitId, spaceName, digest);
    if (r.error !== null) {
      busyRef.current = false;
      setBusy(false);
      if (r.exhausted) openCreditWall(r.exhausted);
      setGenError(r.error);
      return;
    }

    // 先把正文交给用户看 + 落库，扣费出岔子不该连累已经写好的总结。
    const nowIso = new Date().toISOString();
    setDraft(r.content);
    setDraftAt(nowIso);
    const saved = await saveSummary({
      spaceId,
      content: r.content,
      unitTotal: stats.total,
      unitDone: stats.done,
    });
    setStoreMissing(saved.missing);
    if (saved.ok) {
      const fresh = await fetchLatestSummary(spaceId);
      if (fresh.row) {
        setSummary(fresh.row);
        setDraft(null);
        setDraftAt(null);
      }
    }

    // 补扣差价：这次 LLM 调用服务端已按「划词问 AI」扣过 cost_ask_ai，
    // 这里把总价补齐到 cost_space_summary。同一把幂等钥匙，重试不重扣。
    const sp = await spendSpaceSummary(`summary:${spaceId}:${newIdemSuffix()}`);
    if (!sp.ok) {
      if (sp.reason === 'insufficient_credits') {
        openCreditWall({ balance: sp.balance ?? 0, needed: sp.needed ?? price });
      } else if (sp.reason !== 'function_missing') {
        setChargeNote(sp.reason ?? '未知原因');
      }
    }
    refreshCredits();
    busyRef.current = false;
    setBusy(false);
  }, [
    spaceId,
    spaceName,
    learningType,
    phases,
    contents,
    questions,
    stats,
    openCreditWall,
    refreshCredits,
  ]);

  // ── 渲染 ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="app">
        <Appbar cur="path" spaceId={spaceId} />
        <div className="center-state">
          <div className="ring" />
          <div className="st-text">正在读取这个空间的内容…</div>
        </div>
      </div>
    );
  }

  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="app">
      <Appbar cur="path" spaceId={spaceId} />
      <div className="sum-wrap">
        <div className="sum-head">
          <Link className="crumb" href={`/app/space/${spaceId}`}>
            ← {spaceName || '学习路径'}
          </Link>
          <h1>学习总结 · 复盘</h1>
          <p>
            把这个空间里学过的内容和你问过的问题揉成一份可以回看的总结 · 已学完{' '}
            {stats.done}/{stats.total} 单元（{pct}%）
          </p>
        </div>

        {loadError && (
          <div className="savenote failed" style={{ marginBottom: 14 }}>
            读取内容时出错：{loadError}
          </div>
        )}

        {busy ? (
          <div className="genwrap">
            <div className="ring" />
            <h3>正在为你写这份复盘…</h3>
            <p>
              AI 正在把 {stats.generated} 个单元的内容和 {questions.length} 条提问一起读一遍，
              然后写成一份总结。这一次会扣 {cost} 积分；生成失败不扣。
            </p>
          </div>
        ) : shown ? (
          <>
            <div className="sum-meta">
              <span>生成于 {shownAt ? formatTime(shownAt) : '刚刚'}</span>
              {summary?.unit_done != null && summary?.unit_total != null && !draft && (
                <span>
                  · 覆盖当时的 {summary.unit_done}/{summary.unit_total} 单元
                </span>
              )}
              <button
                className="ghost sum-regen"
                onClick={() => setConfirmOpen(true)}
                title={`重新生成这份总结（−${cost} 积分）`}
              >
                重新生成
                <span className="rg-cost">−{cost}</span>
              </button>
            </div>

            {stale && (
              <div className="gen-warn">
                <div className="gw-t">这份总结不是最新的</div>
                <div className="gw-d">
                  生成之后你又学完了新的单元。重新生成一份，才会把新学的内容也算进去。
                </div>
                <button className="ghost" onClick={() => setConfirmOpen(true)}>
                  重新生成（−{cost} 积分）
                </button>
              </div>
            )}

            {storeMissing && (
              <div className="savenote failed">
                这份总结没能保存到云端（后台还没建 space_summaries 表），
                离开本页就会丢失 —— 想留存请先复制走。
              </div>
            )}
            {chargeNote && (
              <div className="savenote failed">
                本次总结没能补扣积分（{chargeNote}）—— 总结照常保存。
              </div>
            )}

            <article className="sum-body">
              <Markdown remarkPlugins={[remarkGfm]}>{shown}</Markdown>
            </article>
          </>
        ) : (
          <div className="sum-intro">
            <div className="si-t">给这个空间做一次复盘</div>
            <ul className="si-list">
              <li>把 {stats.generated} 个已生成单元的内容重新组织成一张知识地图</li>
              <li>挑出必须记住的核心概念</li>
              <li>
                结合你问过的 {questions.length} 条问题，指出你真实的薄弱环节
              </li>
              <li>给出复习顺序和下一步建议</li>
            </ul>
            {genError && <div className="savenote failed">{genError}</div>}
            <button
              className="primary"
              disabled={stats.generated === 0}
              onClick={() => setConfirmOpen(true)}
            >
              生成学习总结（−{cost} 积分）
            </button>
            {stats.generated === 0 && (
              <div className="gen-freenote">
                这个空间还没有已生成的单元内容 —— 先学几个单元再回来。
              </div>
            )}
            {stats.generated > 0 && stats.done === 0 && (
              <div className="gen-freenote">
                你还没标记学完任何单元，现在也能生成，只是复盘会更偏「预习地图」。
              </div>
            )}
          </div>
        )}

        {!busy && shown && genError && (
          <div className="savenote failed" style={{ marginTop: 14 }}>
            {genError}
          </div>
        )}
      </div>

      {confirmOpen && (
        <div className="confirm-wrap">
          <div className="confirm-scrim" onClick={() => setConfirmOpen(false)} />
          <div className="confirm-card" role="dialog" aria-modal="true">
            <h3>{shown ? '重新生成这份总结?' : '生成学习总结?'}</h3>
            <p>
              AI 会读一遍这个空间里 <b>{stats.generated} 个单元</b>的内容和
              <b> {questions.length} 条提问记录</b>，写成一份复盘总结，
              <b>扣 {cost} 积分</b>。生成失败不扣。
              {shown ? '新的一份会覆盖当前显示的总结。' : ''}
            </p>
            <button
              className="confirm-go"
              onClick={() => {
                setConfirmOpen(false);
                void run();
              }}
            >
              {shown ? `重新生成（−${cost} 积分）` : `生成（−${cost} 积分）`}
            </button>
            <button className="confirm-cancel" onClick={() => setConfirmOpen(false)}>
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
