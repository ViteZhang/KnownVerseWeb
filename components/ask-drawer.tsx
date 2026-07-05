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
  selectedText,
  asking,
  answer,
  askError,
  saveStatus,
  onClose,
  onAsk,
}: {
  open: boolean;
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

  // 每次打开抽屉清空输入并聚焦。
  useEffect(() => {
    if (open) {
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open, selectedText]);

  const send = () => {
    const q = value.trim();
    if (!q || asking) return;
    onAsk(q);
  };

  const onChip = (fill: string) => {
    if (asking) return;
    onAsk(fill);
  };

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
          <div className="quote">{selectedText || '（你选中的文字会显示在这里）'}</div>

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
              placeholder="就选中的内容追问…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
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
          <div className="kbd">
            选中文字后按 <b>⌘K</b> 也能唤起 · <b>Enter</b> 发送
          </div>
        </div>
      </aside>
    </>
  );
}
