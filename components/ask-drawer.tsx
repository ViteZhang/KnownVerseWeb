'use client';
import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const PRESET_CHIPS: { label: string; fill: string }[] = [
  { label: '展开讲讲', fill: '能把这一段展开讲讲吗？' },
  { label: '举个例子', fill: '能举一个具体例子吗？' },
  { label: '联系我的背景', fill: '结合我的背景，这个该怎么理解？' },
  { label: '太难了简单点', fill: '这段太难了，能用更简单的方式讲吗？' },
];

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

export function AskDrawer({
  open,
  wholeSection = false,
  selectedText,
  asking,
  answer,
  askError,
  saveStatus,
  onClose,
  onAsk,
}: {
  open: boolean;
  /** 整节提问（手机端悬浮按钮进来的）：引文区展示的是「本节」而不是选中的一段话。 */
  wholeSection?: boolean;
  selectedText: string;
  asking: boolean;
  answer: string | null;
  askError: string | null;
  saveStatus: SaveStatus;
  onClose: () => void;
  onAsk: (question: string) => void;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // 最近一次发出去的问题：发送时输入框立刻清空，万一这次问失败了再把它还回去，
  // 省得用户把一长串问题重打一遍。
  const lastSentRef = useRef('');

  // 每次打开抽屉清空输入。桌面自动聚焦；触屏不自动聚焦 ——
  // 一开抽屉就弹起软键盘会把「预设追问」按钮全顶出屏幕，手机上反而更难用。
  useEffect(() => {
    if (!open) return;
    setValue('');
    lastSentRef.current = '';
    const coarse =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(pointer: coarse)')?.matches === true;
    if (coarse) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open, selectedText]);

  const send = () => {
    const q = value.trim();
    if (!q || asking) return;
    // 先清空再发：onAsk 是异步的，等它回来才清会让输入框一直挂着已经发出去的问题。
    setValue('');
    lastSentRef.current = q;
    onAsk(q);
  };

  const onChip = (fill: string) => {
    if (asking) return;
    // 点预设追问同样清掉输入框里已经打了一半的字，不然发出去的和看到的对不上。
    setValue('');
    lastSentRef.current = fill;
    onAsk(fill);
  };

  // 问失败了（网络/积分/服务端报错）就把刚才那句还给输入框，改一改可以直接重发。
  useEffect(() => {
    if (!askError || !lastSentRef.current) return;
    setValue(lastSentRef.current);
    lastSentRef.current = '';
  }, [askError]);

  return (
    <>
      <div className={`scrim${open ? ' show' : ''}`} onClick={onClose} />
      <aside className={`drawer${open ? ' show' : ''}`}>
        <div className="dr-h">
          <div className="t">
            <span className="badge">问</span>问 AI
          </div>
          <button className="x" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="dr-scroll">
          <div className="quote">
            {wholeSection && (
              <span className="q-scope">就这一节提问</span>
            )}
            {selectedText || '（你选中的文字会显示在这里）'}
          </div>

          {!answer && !asking && (
            <div className="chips">
              {PRESET_CHIPS.map((c) => (
                <span key={c.label} className="chip" onClick={() => onChip(c.fill)}>
                  {c.label}
                </span>
              ))}
            </div>
          )}

          <div className={`loading${asking ? ' show' : ''}`}>
            <span className="spin" />
            AI 正在思考…
          </div>

          {askError && !asking && (
            <p style={{ color: 'var(--danger)', fontSize: 13.5, marginTop: 16 }}>
              {askError}
            </p>
          )}

          <div className={`answer${answer && !asking ? ' show' : ''}`}>
            <div className="alabel">◆ 结合你的学习档案</div>
            {answer && (
              <Markdown remarkPlugins={[remarkGfm]}>{answer}</Markdown>
            )}
            {saveStatus !== 'idle' && (
              <div className={`savenote${saveStatus === 'failed' ? ' failed' : ''}`}>
                {saveStatus === 'saving'
                  ? '正在存入提问记录…'
                  : saveStatus === 'saved'
                    ? '✓ 已存入提问记录'
                    : '未能存入提问记录（不影响阅读）'}
              </div>
            )}
          </div>
        </div>

        <div className="dr-foot">
          <div className="ask-input">
            <input
              ref={inputRef}
              placeholder={wholeSection ? '就这一节追问…' : '就选中的内容追问…'}
              value={value}
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              onChange={(e) => setValue(e.target.value)}
              onFocus={(e) => {
                // 微信/Safari 里软键盘弹起后不会自动把输入框顶上来，手动滚一下。
                const el = e.currentTarget;
                setTimeout(() => el.scrollIntoView({ block: 'center' }), 300);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send();
              }}
            />
            <button className="send" onClick={send} disabled={!value.trim() || asking}>
              <svg viewBox="0 0 24 24">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
          {/* 快捷键说明只对桌面成立；手机端换成对应的操作提示（CSS 控制显隐）。 */}
          <div className="kbd kbd-desktop">
            选中文字后按 <b>⌘K</b> 也能唤起 · <b>Enter</b> 发送
          </div>
          <div className="kbd kbd-touch">
            长按正文选词可就那一句提问 · 回车发送
          </div>
        </div>
      </aside>
    </>
  );
}
