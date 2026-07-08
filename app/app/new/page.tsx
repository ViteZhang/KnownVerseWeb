'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Appbar } from '@/components/appbar';
import {
  extractUserMemory,
  genPath,
  interviewNext,
  summarizeUnderstanding,
  type InterviewTurn,
} from '@/lib/ai';
import { createSpace, persistPath } from '@/lib/spaces';

// 学习类型 → 友好中文（值与 spaces.learning_type 一致）。
const TYPE_LABEL: Record<string, string> = {
  knowledge_career: '知识职业型',
  skill_practice: '技能练习型',
  exam: '应试型',
  reading_reflection: '思辨阅读型',
};
const TYPE_ORDER = [
  'knowledge_career',
  'skill_practice',
  'exam',
  'reading_reflection',
] as const;

const EXAMPLES = [
  '我想学摄影，能拍好旅行时的风景和人像。有一台微单但一直用自动挡。',
  '想系统读一遍西方哲学史，有点哲学基础，以理解为主。',
  '备考 PMP，有 5 年项目经验，想两个月内考过。',
];

type Step =
  | 'input'
  | 'interview'
  | 'summarizing'
  | 'confirm'
  | 'creating'
  | 'created';

const splitList = (s: string) =>
  s
    .split(/[、,，;；]/)
    .map((x) => x.trim())
    .filter(Boolean);

export default function NewSpacePage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('input');
  const [initialInput, setInitialInput] = useState('');
  const [history, setHistory] = useState<InterviewTurn[]>([]);
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [closing, setClosing] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 理解确认页字段。
  const [spaceName, setSpaceName] = useState('');
  const [goalText, setGoalText] = useState('');
  const [baselineText, setBaselineText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [styleText, setStyleText] = useState('');
  const [avoidText, setAvoidText] = useState('');
  const [inferLearningType, setInferLearningType] = useState('knowledge_career');
  const [inferPace, setInferPace] = useState('');
  const [inferDepth, setInferDepth] = useState('');
  const [goalDomain, setGoalDomain] = useState<string | null>(null);
  const [goalDeadline, setGoalDeadline] = useState<string | null>(null);

  const [createdInfo, setCreatedInfo] = useState<{
    spaceId: string;
    phaseCount: number;
    unitCount: number;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollToEnd = () =>
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);

  // ── 访谈结束 → 整理理解 ──────────────────────────────────────────────
  const doSummarize = useCallback(
    async (firstInput: string, hist: InterviewTurn[]) => {
      setError(null);
      const res = await summarizeUnderstanding(firstInput, hist);
      if (res.error !== null) {
        setError(res.error);
        return;
      }
      // 顺手抽取「关于这个人」的用户级记忆并合并写回，不阻塞展示。
      void extractUserMemory(firstInput, hist);
      const u = res.data;
      setSpaceName(u.space_name ?? '');
      setGoalDomain(u.static?.goal?.domain ?? null);
      setGoalDeadline(u.static?.goal?.deadline ?? null);
      setGoalText(u.static?.goal?.target_state ?? '');
      setBaselineText(u.static?.baseline?.summary ?? '');
      setTimeText(u.static?.time?.summary ?? '');
      setStyleText((u.static?.preferences?.style ?? []).join('、'));
      setAvoidText((u.static?.preferences?.avoid ?? []).join('、'));
      const inferred = u.inferences?.learning_type ?? '';
      setInferLearningType(
        (TYPE_ORDER as readonly string[]).includes(inferred)
          ? inferred
          : 'knowledge_career',
      );
      setInferPace(u.inferences?.pace ?? '');
      setInferDepth(u.inferences?.depth_level ?? '');
      setStep('confirm');
    },
    [],
  );

  // ── 调一轮 interview_next ─────────────────────────────────────────────
  const runTurn = useCallback(
    async (firstInput: string, nextHistory: InterviewTurn[]) => {
      setAsking(true);
      setError(null);
      const res = await interviewNext(firstInput, nextHistory);
      setAsking(false);
      if (res.error !== null) {
        setError(res.error);
        return;
      }
      if (res.status === 'done') {
        setClosing(res.question || '好的，我已经了解得差不多了。');
        setStep('summarizing');
        void doSummarize(firstInput, nextHistory);
        return;
      }
      setHistory((prev) => [...prev, { role: 'ai', text: res.question }]);
      scrollToEnd();
    },
    [doSummarize],
  );

  const startInterview = () => {
    const input = initialInput.trim();
    if (!input) return;
    setStep('interview');
    void runTurn(input, []);
    scrollToEnd();
  };

  const sendAnswer = () => {
    const a = answer.trim();
    if (!a || asking) return;
    const nextHistory: InterviewTurn[] = [...history, { role: 'user', text: a }];
    setHistory(nextHistory);
    setAnswer('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    scrollToEnd();
    void runTurn(initialInput.trim(), nextHistory);
  };

  // ── 确认 → 落库 + 生成路径 ────────────────────────────────────────────
  const onConfirm = async () => {
    setStep('creating');
    setError(null);

    const staticProfile = {
      goal: {
        domain: goalDomain,
        target_state: goalText.trim(),
        deadline: goalDeadline,
      },
      baseline: { summary: baselineText.trim() },
      time: { summary: timeText.trim() },
      preferences: { style: splitList(styleText), avoid: splitList(avoidText) },
      depth_level: inferDepth || null,
    };
    const learningType = inferLearningType || 'knowledge_career';

    const created = await createSpace({
      spaceName: spaceName.trim() || '我的学习空间',
      learningType,
      staticProfile,
    });
    if (created.error || !created.spaceId) {
      setError(created.error ?? '创建空间失败。');
      return;
    }

    const path = await genPath(created.spaceId);
    if (path.error !== null) {
      setError(path.error);
      return;
    }

    const saved = await persistPath(created.spaceId, path.phases);
    if (!saved.ok) {
      setError(`路径保存失败：${saved.error ?? ''}`);
      return;
    }

    setCreatedInfo({
      spaceId: created.spaceId,
      phaseCount: saved.phaseCount,
      unitCount: saved.unitCount,
    });
    setStep('created');
  };

  const autoGrow = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  return (
    <div className="app">
      <Appbar cur="home" />

      {/* 1) 单输入 */}
      {step === 'input' && (
        <div className="ns-wrap">
          <div className="ns-badge">新</div>
          <h1>你想学点什么？</h1>
          <div className="lead">
            一句话或一段话都行——想学什么、现在的基础、想到什么程度、大概能投入多少时间。
            <br />
            说得越具体，AI 追问越少。
          </div>
          <div className="ns-box">
            <textarea
              value={initialInput}
              onChange={(e) => setInitialInput(e.target.value)}
              placeholder="例如：我想学摄影，能拍好旅行时的风景和人像。有一台微单但一直用自动挡……"
            />
            <div className="ns-foot">
              <span className="ns-hint">AI 会先和你聊几句，补全它需要了解的信息</span>
              <button
                className="primary"
                disabled={!initialInput.trim()}
                onClick={startInterview}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                开始
              </button>
            </div>
          </div>
          <div className="ns-examples">
            {EXAMPLES.map((ex) => (
              <span
                key={ex}
                className="ns-ex"
                onClick={() => setInitialInput(ex)}
              >
                {ex.length > 12 ? ex.slice(0, 10) + '…' : ex}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 2) 访谈对话 */}
      {step === 'interview' && (
        <div className="iv-wrap">
          <div className="iv-top">
            <span className="dot" />
            <span className="t">入学访谈</span>
            <span className="p">
              {asking ? '思考中…' : `已聊 ${history.filter((h) => h.role === 'ai').length} 轮`}
            </span>
          </div>
          <div className="iv-scroll" ref={scrollRef}>
            <div className="bubble me">{initialInput.trim()}</div>
            {history.map((t, i) => (
              <div key={i} className={`bubble ${t.role === 'user' ? 'me' : 'ai'}`}>
                {t.text}
              </div>
            ))}
            {asking && (
              <div className="typing">
                <i />
                <i />
                <i />
              </div>
            )}
            {error && (
              <div className="iv-err">
                {error}
                <div style={{ marginTop: 8 }}>
                  <button
                    className="ghost"
                    onClick={() => runTurn(initialInput.trim(), history)}
                  >
                    重试
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="iv-input">
            <div className="box">
              <textarea
                ref={inputRef}
                rows={1}
                value={answer}
                placeholder="回复…"
                onChange={(e) => setAnswer(e.target.value)}
                onInput={autoGrow}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendAnswer();
                  }
                }}
              />
              <button
                className="send"
                disabled={!answer.trim() || asking}
                onClick={sendAnswer}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3) 整理理解中 */}
      {step === 'summarizing' && (
        <div className="genwrap">
          {error ? (
            <>
              <h3>整理出错</h3>
              <p>{error}</p>
              <button
                className="primary retry"
                onClick={() => doSummarize(initialInput.trim(), history)}
              >
                重试
              </button>
            </>
          ) : (
            <>
              <div className="ring" />
              <h3>正在整理我对你的理解…</h3>
              <p>{closing}</p>
            </>
          )}
        </div>
      )}

      {/* 4) 理解确认页 */}
      {step === 'confirm' && (
        <div className="cf-wrap">
          <div className="cf-head">
            <h1>这是我对你的理解</h1>
            <p>
              路径会完全基于它来排。看看哪里不准，点「改」直接修改——
              <br />
              你改的每一处，都会让后面的内容更贴合你。
            </p>
          </div>

          <EditCard
            label="空间名称"
            value={spaceName}
            onChange={setSpaceName}
            icon="star"
          />
          <EditCard
            label="学习目标"
            value={goalText}
            onChange={setGoalText}
            icon="target"
          />
          <EditCard
            label="起点水平"
            value={baselineText}
            onChange={setBaselineText}
            icon="doc"
          />
          <EditCard
            label="可投入时间"
            value={timeText}
            onChange={setTimeText}
            icon="clock"
          />
          <PrefCard
            styleText={styleText}
            avoidText={avoidText}
            onStyle={setStyleText}
            onAvoid={setAvoidText}
          />

          <div className="cf-infer">
            <div className="ih">◆ 我的推断，请纠正我</div>
            <div className="isub">这几项是我根据你的回答推测的，拿不准，你说了算。</div>
            <div className="infer-row">
              <span className="il">学习类型</span>
              <div className="type-chips" style={{ flex: 1 }}>
                {TYPE_ORDER.map((t) => (
                  <button
                    key={t}
                    className={`type-chip${inferLearningType === t ? ' on' : ''}`}
                    onClick={() => setInferLearningType(t)}
                  >
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="infer-row">
              <span className="il">建议节奏</span>
              <div className="iv-val">{inferPace || '—'}</div>
            </div>
            <div className="infer-row">
              <span className="il">起点深度</span>
              <div className="iv-val">{inferDepth || '—'}</div>
            </div>
          </div>

          <div className="cf-actions">
            <button className="ghost" onClick={() => setStep('interview')}>
              ← 补充几句
            </button>
            <button className="primary" style={{ flex: 1 }} onClick={onConfirm}>
              <svg viewBox="0 0 24 24">
                <path d="M5 12l5 5L20 7" />
              </svg>
              确认，生成学习路径
            </button>
          </div>
        </div>
      )}

      {/* 5) 生成中 */}
      {step === 'creating' && (
        <div className="genwrap">
          {error ? (
            <>
              <h3>出错了</h3>
              <p>{error}</p>
              <button className="primary retry" onClick={() => setStep('confirm')}>
                返回修改
              </button>
            </>
          ) : (
            <>
              <div className="ring" />
              <h3>正在为你规划学习路径…</h3>
              <p>
                按你的目标、起点和可投入时间排阶段与单元。只排标题，正文在你点进单元时再现生成，稍等十几秒。
              </p>
            </>
          )}
        </div>
      )}

      {/* 6) 已就绪 */}
      {step === 'created' && createdInfo && (
        <div className="genwrap">
          <div
            className="check"
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--sage-wash)',
              display: 'grid',
              placeItems: 'center',
              marginBottom: 20,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              style={{
                width: 28,
                height: 28,
                stroke: 'var(--sage)',
                fill: 'none',
                strokeWidth: 2.5,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              }}
            >
              <path d="M5 12l5 5L20 7" />
            </svg>
          </div>
          <h3>路径已就绪</h3>
          <p>
            「{spaceName || '我的学习空间'}」· {createdInfo.phaseCount} 个阶段 ·{' '}
            {createdInfo.unitCount} 单元
          </p>
          <button
            className="primary retry"
            onClick={() => router.push(`/app/space/${createdInfo.spaceId}`)}
          >
            <svg viewBox="0 0 24 24">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            进入空间，开始学习
          </button>
        </div>
      )}
    </div>
  );
}

// ── 可编辑事实卡片（点「改」就地编辑）──────────────────────────────────
const ICONS: Record<string, React.ReactNode> = {
  star: <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="1.5" fill="var(--amber-deep)" stroke="none" />
    </>
  ),
  doc: <path d="M4 19V6a2 2 0 0 1 2-2h9l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
};

function EditCard({
  label,
  value,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: string;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="cf-card">
      <div className="ch">
        <span className="ci">
          <svg viewBox="0 0 24 24">{ICONS[icon]}</svg>
        </span>
        <span className="cl">{label}</span>
        <button className="edit" onClick={() => setEditing((v) => !v)}>
          {editing ? '完成' : '改'}
        </button>
      </div>
      {editing ? (
        <textarea
          className="cbody"
          autoFocus
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="cbody">{value || '（访谈未覆盖，可点「改」补充）'}</div>
      )}
    </div>
  );
}

function PrefCard({
  styleText,
  avoidText,
  onStyle,
  onAvoid,
}: {
  styleText: string;
  avoidText: string;
  onStyle: (v: string) => void;
  onAvoid: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="cf-card">
      <div className="ch">
        <span className="ci">
          <svg viewBox="0 0 24 24">
            <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" />
          </svg>
        </span>
        <span className="cl">学习偏好</span>
        <button className="edit" onClick={() => setEditing((v) => !v)}>
          {editing ? '完成' : '改'}
        </button>
      </div>
      {editing ? (
        <>
          <div className="cf-field-label">喜欢（顿号分隔）</div>
          <textarea
            className="cbody"
            rows={1}
            value={styleText}
            onChange={(e) => onStyle(e.target.value)}
            placeholder="如 案例驱动、多实拍"
          />
          <div className="cf-field-label" style={{ marginTop: 10 }}>
            希望避免
          </div>
          <textarea
            className="cbody"
            rows={1}
            value={avoidText}
            onChange={(e) => onAvoid(e.target.value)}
            placeholder="如 纯理论堆砌"
          />
        </>
      ) : (
        <div className="cbody">
          {styleText && <>偏好 {styleText}</>}
          {styleText && avoidText && '；'}
          {avoidText && <>不喜欢 {avoidText}</>}
          {!styleText && !avoidText && '（访谈未覆盖，可点「改」补充）'}
        </div>
      )}
    </div>
  );
}
