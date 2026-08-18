'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AskDrawer, type SaveStatus } from '@/components/ask-drawer';
import { ReadingBlocks, headingsOf } from '@/components/reading-blocks';
import { usePaywall } from '@/components/paywall/paywall-provider';
import { askAI, genUnitStream } from '@/lib/ai';
import { BILLING_FALLBACK, getBillingConfigPublic } from '@/lib/billing';
import { getCreditStatus, spendCredits } from '@/lib/credits';
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

// 幂等钥匙后缀：老 webview 里 crypto.randomUUID 可能不存在，退回时间戳 + 随机数。
function newIdemSuffix(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function UnitPage({
  params,
}: {
  params: { id: string; unitId: string };
}) {
  const { id: spaceId, unitId } = params;
  const router = useRouter();
  const { openCreditWall, refreshCredits } = usePaywall();

  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phases, setPhases] = useState<PhaseWithUnits[]>([]);

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [persistWarn, setPersistWarn] = useState(false);

  // ── 重新生成本单元（生成不完善时的补救）────────────────────────────
  // regenMode：本次生成是不是「重新生成」（影响文案与扣费）。
  // truncated：流没收到结束标记就断了 —— 内容多半只写了一半，明确提示可重生成。
  const [regenMode, setRegenMode] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [truncated, setTruncated] = useState(false);
  // 重新生成该扣的积分没扣上时的实话提示（含服务端原因，便于定位）。
  const [chargeNote, setChargeNote] = useState<string | null>(null);
  const [genCost, setGenCost] = useState(BILLING_FALLBACK.cost_unit_generation);
  // 价签同时存一份 ref：runGeneration 只读它，价签异步到货时不会改变回调身份、
  // 从而不会连累 load 的依赖、触发第二次自动生成。
  const genCostRef = useRef(genCost);
  useEffect(() => {
    // 单元生成价签只从 billing_config_public 取（§2：数字不写死在前端）。
    getBillingConfigPublic().then((c) => {
      setGenCost(c.cost_unit_generation);
      genCostRef.current = c.cost_unit_generation;
    });
  }, []);

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
  // 生成互斥锁：自动生成与「重新生成」不会撞在一起，也挡住按钮连点。
  const genBusyRef = useRef(false);

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

  // ── 生成单元内容：流式逐块渲染，收齐后一次性固化 ──────────────────
  // charge=true 表示这是「重新生成」：首次生成由 ai-task 内部按 idem=<unit_id> 扣费，
  // 同一单元再生成会命中服务端幂等而不扣，所以重生成这一次的积分由前端补扣（§6）。
  // 扣费放在生成成功之后：生成失败不该让用户白花积分（前端拿不到退款口）。
  const runGeneration = useCallback(
    async (u: Unit, opts?: { charge?: boolean }) => {
      if (genBusyRef.current) return; // 已有一次生成在跑：不重复开流、不重复扣费
      const charge = opts?.charge === true;
      const cost = genCostRef.current;
      // 重生成一个已学完的单元，不该把「已完成」打回「学习中」。
      const keepStatus = u.status === 'done' ? 'done' : 'learning';
      genBusyRef.current = true;
      setGenerating(true);
      setRegenMode(charge);
      setGenError(null);
      setPersistWarn(false);
      setTruncated(false);
      setChargeNote(null);

      // 重新生成：先看余额够不够，不够直接弹积分墙，不白跑一趟 LLM。
      if (charge) {
        const st = await getCreditStatus();
        if (st && st.balance < cost) {
          genBusyRef.current = false;
          setGenerating(false);
          setRegenMode(false);
          openCreditWall({ balance: st.balance, needed: cost });
          return;
        }
      }

      // 重新生成的幂等钥匙：一把钥匙同时交给服务端和前端补扣口 —— 谁扣都行，最多扣一次。
      const idem = charge ? `regen:${u.id}:${newIdemSuffix()}` : undefined;

      // 起手先清空该单元内容，避免旧块残留；随后每收到一块就追加渲染。
      setUnit((prev) =>
        prev && prev.id === u.id ? { ...prev, content: [], status: keepStatus } : prev,
      );
      const r = await genUnitStream(
        u.space_id,
        u.id,
        (block) => {
          setUnit((prev) =>
            prev && prev.id === u.id
              ? { ...prev, content: [...(prev.content ?? []), block] }
              : prev,
          );
        },
        idem,
      );
      genBusyRef.current = false;
      setGenerating(false);
      setRegenMode(false);
      if (r.exhausted) {
        openCreditWall(r.exhausted); // 积分不足 → 弹积分墙
        setGenError(r.error ?? '本月积分已用完。');
        return;
      }
      if (r.error !== null || r.blocks.length === 0) {
        setGenError(r.error ?? '内容生成失败，请稍后重试。');
        return;
      }
      // 以收齐的完整块数组为准回填 + 固化（防止流式过程中的状态竞态）。
      setUnit((prev) =>
        prev && prev.id === u.id
          ? { ...prev, content: r.blocks, status: keepStatus }
          : prev,
      );
      setTruncated(Boolean(r.truncated));

      // 先把内容固化：扣费出任何岔子都不该连累已经写好的正文。
      const p = await persistUnitContent(u.id, r.blocks, keepStatus);
      setPersistWarn(!p.ok);

      if (charge && idem) {
        // 用同一把 idem 补扣：服务端若认了 idemKey 已经扣过，这里会命中幂等
        // （spend_credits 返回 ok + idempotent_replay），不会重复扣。
        try {
          const sp = await spendCredits(cost, 'unit_generation', idem);
          if (!sp.ok) {
            if (sp.reason === 'insufficient_credits') {
              openCreditWall({ balance: sp.balance ?? 0, needed: sp.needed ?? cost });
            } else {
              // 不拦着用户读已生成的内容，但要说实话：这次没扣成，并带上原因。
              console.warn('[unit] 重新生成补扣积分失败:', sp.reason);
              setChargeNote(sp.reason ?? '未知原因');
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : '未知原因';
          console.warn('[unit] 重新生成补扣积分异常:', msg);
          setChargeNote(msg);
        }
      }
      refreshCredits(); // 扣费落账 → 刷新余额条
    },
    [openCreditWall, refreshCredits],
  );

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
          router.push(`/app/space/${spaceId}/unit/${target.id}`);
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
        if (res.exhausted) openCreditWall(res.exhausted); // 积分不足 → 弹积分墙
        setAskError(res.error);
        return;
      }
      setAnswer(res.answer);
      refreshCredits(); // 扣费成功 → 刷新余额条

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
    [unit, selIndex, selText, blocks, openCreditWall, refreshCredits],
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
      router.push(`/app/space/${spaceId}/unit/${next.id}`);
    } else {
      router.push(`/app/space/${spaceId}`);
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
              onClick={() => router.push(`/app/space/${spaceId}`)}
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
                    onClick={() => router.push(`/app/space/${spaceId}/unit/${u.id}`)}
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
          ) : generating && blocks.length === 0 ? (
            <div className="genwrap">
              <div className="ring" />
              <h3>{regenMode ? '正在重新生成这一单元…' : '正在为你生成这一单元…'}</h3>
              <p>
                {regenMode
                  ? `AI 正重写本单元，写完会覆盖旧内容。这一次会扣 ${genCost} 积分；万一生成失败，不扣。`
                  : 'AI 正结合你的学习档案按内容模板撰写本单元。内容会边写边显示，生成后永久保存，下次直接打开。'}
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
              <div className="gen-freenote">重试失败的生成不额外扣积分。</div>
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
                    onClick={() => router.push(`/app/space/${spaceId}`)}
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

                {chargeNote && (
                  <div className="savenote failed" style={{ marginTop: 12 }}>
                    本次重新生成没能扣除积分（{chargeNote}）—— 内容照常保存，
                    积分流水里不会有这一笔。
                  </div>
                )}

                {truncated && !generating && (
                  <div className="gen-warn">
                    <div className="gw-t">这一单元可能没写完</div>
                    <div className="gw-d">
                      内容在中途断了，下面只是已经写出来的部分。可以重新生成一次，
                      重写会覆盖当前内容并扣 {genCost} 积分。
                    </div>
                    <button className="ghost" onClick={() => setRegenOpen(true)}>
                      重新生成本单元
                    </button>
                  </div>
                )}

                <ReadingBlocks blocks={blocks as ContentBlock[]} />

                {generating && blocks.length > 0 && (
                  <div className="stream-more">
                    <span className="dots">
                      <i />
                      <i />
                      <i />
                    </span>
                    正在续写…
                  </div>
                )}

                <div className="rd-actions">
                  {unit.status === 'done' ? (
                    <span className="done-tag">✓ 已学完本单元</span>
                  ) : (
                    <button
                      className="primary"
                      disabled={completing || generating || blocks.length === 0}
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
                        router.push(`/app/space/${spaceId}/unit/${nextUnit.id}`)
                      }
                    >
                      下一单元 →
                    </button>
                  )}
                  {/* 生成得不完整时的兜底：重写本单元，重新扣积分。 */}
                  <button
                    className="ghost regen-btn"
                    disabled={generating || blocks.length === 0}
                    onClick={() => setRegenOpen(true)}
                    title={`重新生成本单元（−${genCost} 积分）`}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
                      <path d="M20 5v6h-6" />
                    </svg>
                    重新生成
                    <span className="rg-cost">−{genCost}</span>
                  </button>
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

      {/* 重新生成二次确认：明确「覆盖旧内容 + 重新扣积分」 */}
      {regenOpen && (
        <div className="confirm-wrap">
          <div className="confirm-scrim" onClick={() => setRegenOpen(false)} />
          <div className="confirm-card" role="dialog" aria-modal="true">
            <h3>重新生成这一单元?</h3>
            <p>
              AI 会把本单元重写一遍，<b>覆盖当前内容</b>（旧内容不保留），并
              <b>重新扣 {genCost} 积分</b>。生成失败不扣。本单元的提问记录、学习进度不受影响。
            </p>
            <button
              className="confirm-go"
              onClick={() => {
                setRegenOpen(false);
                if (unit) void runGeneration(unit, { charge: true });
              }}
            >
              重新生成（−{genCost} 积分）
            </button>
            <button className="confirm-cancel" onClick={() => setRegenOpen(false)}>
              取消
            </button>
          </div>
        </div>
      )}

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
