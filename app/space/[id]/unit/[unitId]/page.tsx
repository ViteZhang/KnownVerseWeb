'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AskDrawer, type SaveStatus } from '@/components/ask-drawer';
import { ReadingBlocks, headingsOf } from '@/components/reading-blocks';
import { askAI, genUnit } from '@/lib/ai';
import {
  DEFAULT_PREFS,
  fetchReadingPrefs,
  prefsToStyle,
  type ReadingPrefs,
} from '@/lib/reading-prefs';
import { fetchReadingProgress, saveReadingProgress } from '@/lib/reading-progress';
import { saveQuestion } from '@/lib/questions';
import { buildSectionContext } from '@/lib/section-context';
import {
  fetchSpacePath,
  findNextUnit,
  markUnitDone,
} from '@/lib/spaces';
import { fetchUnitById, persistUnitContent } from '@/lib/units';
import type { ContentBlock, PhaseWithUnits, Unit } from '@/lib/types';

export default function UnitPage({
  params,
}: {
  params: { id: string; unitId: string };
}) {
  const { id: spaceId, unitId } = params;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phases, setPhases] = useState<PhaseWithUnits[]>([]);

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [persistWarn, setPersistWarn] = useState(false);

  const [railCollapsed, setRailCollapsed] = useState(false);
  const [tocCur, setTocCur] = useState<string | null>(null);

  // 阅读偏好（随账号，跨设备）。加载前用默认档，避免闪动。
  const [prefs, setPrefs] = useState<ReadingPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    fetchReadingPrefs().then(setPrefs);
  }, []);

  // 划词选区
  const [selText, setSelText] = useState('');
  const [selIndex, setSelIndex] = useState<number | null>(null);
  const [bubble, setBubble] = useState<{ x: number; y: number; show: boolean }>({
    x: 0,
    y: 0,
    show: false,
  });

  // 抽屉
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // 标记完成
  const [completing, setCompleting] = useState(false);

  const readingRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  const blocks = useMemo(() => unit?.content ?? [], [unit?.content]);
  const headings = useMemo(() => headingsOf(blocks), [blocks]);

  // 本单元所属阶段 + 上下文信息（用于 kicker / 下一单元）。
  const myPhase = useMemo(
    () => phases.find((p) => p.units.some((u) => u.id === unitId)) ?? null,
    [phases, unitId],
  );
  const nextUnit = useMemo(() => findNextUnit(phases), [phases]);

  // 路径中的完整单元顺序（键盘 J/K 定位切换，与左侧轨道点击行为一致）。
  const orderedUnits = useMemo(() => phases.flatMap((p) => p.units), [phases]);
  const curIndex = useMemo(
    () => orderedUnits.findIndex((u) => u.id === unitId),
    [orderedUnits, unitId],
  );

  // ── 生成单元内容（未生成时）─────────────────────────────────────────
  const runGeneration = useCallback(async (u: Unit) => {
    setGenerating(true);
    setGenError(null);
    setPersistWarn(false);
    const r = await genUnit(u.space_id, u.id);
    setGenerating(false);
    if (r.error !== null || !r.content) {
      setGenError(r.error ?? '内容生成失败，请稍后重试。');
      return;
    }
    setUnit((prev) =>
      prev && prev.id === u.id
        ? { ...prev, content: r.content, status: 'learning' }
        : prev,
    );
    const p = await persistUnitContent(u.id, r.content);
    setPersistWarn(!p.ok);
  }, []);

  // ── 加载单元 + 路径 ───────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    restoredRef.current = false;
    const [res, path] = await Promise.all([
      fetchUnitById(unitId),
      fetchSpacePath(spaceId),
    ]);
    setPhases(path.phases);
    if (res.error !== null) {
      setUnit(null);
      setError(res.error === 'NO_ROWS' ? '读不到这条单元（可能不属于当前账号）。' : res.error);
      setLoading(false);
      return;
    }
    setUnit(res.unit);
    setError(null);
    setLoading(false);
    if (
      res.unit.status !== 'done' &&
      (!res.unit.content || res.unit.content.length === 0)
    ) {
      void runGeneration(res.unit);
    }
  }, [unitId, spaceId, runGeneration]);

  useEffect(() => {
    void load();
  }, [load]);

  // 进入单元即记一次断点（unit 级），anchor 待滚动时补。
  useEffect(() => {
    if (unit) void saveReadingProgress(spaceId, unitId, null);
  }, [unit, spaceId, unitId]);

  // ── 划词 → 气泡 ───────────────────────────────────────────────────
  const clearBubble = useCallback(() => {
    setBubble((b) => (b.show ? { ...b, show: false } : b));
  }, []);

  const handleMouseUp = useCallback(() => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return clearBubble();
      const text = sel.toString().trim();
      const reading = readingRef.current;
      if (text.length >= 2 && reading && reading.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        // 定位所在块 index（para/card 带 data-block-index）。
        let node: Node | null = range.startContainer;
        let el = node.nodeType === 3 ? node.parentElement : (node as HTMLElement);
        const blockEl = el?.closest('[data-block-index]') as HTMLElement | null;
        if (!blockEl) return clearBubble();
        const idx = Number(blockEl.dataset.blockIndex);
        const rect = range.getBoundingClientRect();
        setSelText(text);
        setSelIndex(idx);
        setBubble({
          x: rect.left + rect.width / 2,
          y: rect.top,
          show: true,
        });
      } else {
        clearBubble();
      }
    }, 10);
  }, [clearBubble]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.selbubble')) clearBubble();
    };
    const onScroll = () => clearBubble();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [clearBubble]);

  // ── 抽屉 / 提问 ───────────────────────────────────────────────────
  const openDrawer = useCallback(() => {
    setAnswer(null);
    setAskError(null);
    setAsking(false);
    setSaveStatus('idle');
    setDrawerOpen(true);
    clearBubble();
  }, [clearBubble]);

  // ⌘K / Ctrl+K：选中文字直接唤起；Esc 关闭。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const text = window.getSelection()?.toString().trim() ?? '';
        const reading = readingRef.current;
        const anchor = window.getSelection()?.anchorNode ?? null;
        if (text.length >= 2 && reading && reading.contains(anchor)) {
          e.preventDefault();
          openDrawer();
        }
      }
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openDrawer]);

  // J/K 上下单元 · [ 收起/展开目录（桌面快捷键，§4.2）。
  // 只在无修饰键、非输入态、抽屉关闭时生效；⌘K 由上面的处理器负责。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || drawerOpen) return;
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable)
      )
        return;
      const k = e.key.toLowerCase();
      if (k === '[') {
        e.preventDefault();
        setRailCollapsed((v) => !v);
      } else if (k === 'j' || k === 'k') {
        if (curIndex < 0) return;
        const target =
          k === 'j' ? orderedUnits[curIndex + 1] : orderedUnits[curIndex - 1];
        if (target) {
          e.preventDefault();
          router.push(`/space/${spaceId}/unit/${target.id}`);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, curIndex, orderedUnits, router, spaceId]);

  const onAsk = useCallback(
    async (question: string) => {
      if (!unit || selIndex == null) return;
      setAsking(true);
      setAskError(null);
      setAnswer(null);
      setSaveStatus('idle');

      const res = await askAI({
        spaceId: unit.space_id,
        unitId: unit.id,
        selectedText: selText,
        sectionContext: buildSectionContext(blocks as ContentBlock[], selIndex),
        question,
      });

      setAsking(false);
      if (res.error !== null) {
        setAskError(res.error);
        return;
      }
      setAnswer(res.answer);

      // 后台写入提问记录（最小写入：仅 insert questions），失败不阻塞。
      setSaveStatus('saving');
      saveQuestion({
        spaceId: unit.space_id,
        unitId: unit.id,
        selectedText: selText,
        question,
        answer: res.answer,
      }).then((r) => setSaveStatus(r.ok ? 'saved' : 'failed'));
    },
    [unit, selIndex, selText, blocks],
  );

  // ── 目录滚动高亮 + 断点 anchor 防抖保存 ────────────────────────────
  useEffect(() => {
    if (headings.length === 0) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      // 当前 anchor：视口上沿之上最近的 h2。
      let cur: string | null = headings[0]?.id ?? null;
      for (const h of headings) {
        const el = document.getElementById(h.id);
        if (el && el.getBoundingClientRect().top <= 90) cur = h.id;
      }
      setTocCur(cur);
      if (timer) clearTimeout(timer);
      // anchor 跨端约定为「标题块在 content[] 里的序号」纯数字字符串（与 App 一致）。
      // 标题 DOM id 形如 sec-<i>，i 即块序号，去前缀存 i。
      const anchorIndex = cur ? cur.replace('sec-', '') : null;
      timer = setTimeout(() => {
        void saveReadingProgress(spaceId, unitId, anchorIndex);
      }, 1500);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      if (timer) clearTimeout(timer);
    };
  }, [headings, spaceId, unitId]);

  // 首次进入恢复断点 anchor（仅当记录指向本单元）。
  useEffect(() => {
    if (restoredRef.current || blocks.length === 0) return;
    restoredRef.current = true;
    fetchReadingProgress(spaceId).then((p) => {
      if (p && p.unit_id === unitId && p.anchor) {
        // anchor 为块序号（与 App 一致）；标题块渲染为 id="sec-<序号>"。
        const el = document.getElementById(`sec-${p.anchor}`);
        if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    });
  }, [blocks.length, spaceId, unitId]);

  const onMarkDone = async () => {
    if (!unit || completing) return;
    setCompleting(true);
    await markUnitDone(unit.id);
    setUnit((prev) => (prev ? { ...prev, status: 'done' } : prev));
    setCompleting(false);
    // 跳下一单元，否则回路径页。
    const path = await fetchSpacePath(spaceId);
    const next = findNextUnit(path.phases);
    if (next && next.id !== unit.id) {
      router.push(`/space/${spaceId}/unit/${next.id}`);
    } else {
      router.push(`/space/${spaceId}`);
    }
  };

  const jumpToc = (hid: string) => {
    document.getElementById(hid)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── 渲染 ──────────────────────────────────────────────────────────
  const kicker = myPhase
    ? `${myPhase.title}${unit?.title ? '' : ''}`
    : '单元学习';

  return (
    <div className="app" style={{ maxWidth: 'none', margin: 0 }}>
      <div className={`read-grid${railCollapsed ? ' rail-collapsed' : ''}`}>
        {/* 左：路径轨道 */}
        <div className="read-rail">
          <div className="rr-sp">
            <span
              style={{ cursor: 'pointer', color: 'var(--amber-deep)' }}
              onClick={() => router.push(`/space/${spaceId}`)}
            >
              ← 学习路径
            </span>
          </div>
          {phases.map((p) => (
            <div key={p.id}>
              <h4>{p.title}</h4>
              {p.units.map((u) => {
                const cls = [
                  'rr-unit',
                  u.status === 'done' ? 'done' : '',
                  u.id === unitId ? 'cur' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <div
                    key={u.id}
                    className={cls}
                    onClick={() => router.push(`/space/${spaceId}/unit/${u.id}`)}
                  >
                    <span className="d" />
                    {u.title}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* 中：阅读正文 */}
        <div className="reading" ref={readingRef} onMouseUp={handleMouseUp}>
          {loading ? (
            <div className="center-state">
              <div className="ring" />
              <div className="st-text">正在读取单元…</div>
            </div>
          ) : error ? (
            <div className="center-state">
              <div className="st-title">读不到这条单元</div>
              <div className="st-text">{error}</div>
            </div>
          ) : generating ? (
            <div className="genwrap">
              <div className="ring" />
              <h3>正在为你生成这一单元…</h3>
              <p>
                AI 正结合你的学习档案按内容模板撰写本单元。生成后会永久保存，下次直接打开。
              </p>
            </div>
          ) : genError ? (
            <div className="genwrap">
              <h3>生成失败</h3>
              <p>{genError}</p>
              <button
                className="primary retry"
                onClick={() => unit && runGeneration(unit)}
              >
                点此重试
              </button>
            </div>
          ) : (
            unit && (
              <div className="read-inner" style={prefsToStyle(prefs)}>
                <div className="rd-top">
                  <button
                    className="railtoggle"
                    title="收起 / 展开目录"
                    onClick={() => setRailCollapsed((v) => !v)}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M4 6h16M4 12h10M4 18h16" />
                    </svg>
                  </button>
                  <div className="rd-kicker">{kicker}</div>
                  <span
                    className="rd-back"
                    onClick={() => router.push(`/space/${spaceId}`)}
                  >
                    返回路径
                  </span>
                </div>
                <div className="rd-title">{unit.title ?? '(无标题单元)'}</div>

                {persistWarn && (
                  <div className="savenote failed" style={{ marginTop: 12 }}>
                    内容已生成可阅读，但未能存入云端；下次进入会重新生成。
                  </div>
                )}

                <ReadingBlocks blocks={blocks as ContentBlock[]} />

                <div className="rd-actions">
                  {unit.status === 'done' ? (
                    <span className="done-tag">✓ 已学完本单元</span>
                  ) : (
                    <button
                      className="primary"
                      disabled={completing || blocks.length === 0}
                      onClick={onMarkDone}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                      {completing ? '正在标记…' : '标记学完'}
                    </button>
                  )}
                  {nextUnit && nextUnit.id !== unit.id && (
                    <button
                      className="ghost"
                      onClick={() =>
                        router.push(`/space/${spaceId}/unit/${nextUnit.id}`)
                      }
                    >
                      下一单元 →
                    </button>
                  )}
                </div>
              </div>
            )
          )}
        </div>

        {/* 右：单元内目录 */}
        <div className="toc">
          {headings.length > 0 && (
            <>
              <div className="th">本单元目录</div>
              {headings.map((h) => (
                <a
                  key={h.id}
                  className={tocCur === h.id ? 'cur' : ''}
                  onClick={() => jumpToc(h.id)}
                >
                  {h.text}
                </a>
              ))}
              <div className="hint">
                选中正文任意文字，即可就地问 AI —— 它带着你的档案作答。
              </div>
            </>
          )}
        </div>
      </div>

      {/* 划词气泡 */}
      <div
        className={`selbubble${bubble.show ? ' show' : ''}`}
        style={{ left: bubble.x, top: bubble.y }}
        onClick={openDrawer}
      >
        <svg viewBox="0 0 24 24">
          <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z" />
        </svg>
        问 AI
      </div>

      {/* 右侧问 AI 抽屉 */}
      <AskDrawer
        open={drawerOpen}
        selectedText={selText}
        asking={asking}
        answer={answer}
        askError={askError}
        saveStatus={saveStatus}
        onClose={() => setDrawerOpen(false)}
        onAsk={onAsk}
      />
    </div>
  );
}
