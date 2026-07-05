'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Appbar } from '@/components/appbar';
import { fetchQuestions } from '@/lib/questions';
import { fetchSpacePath } from '@/lib/spaces';
import type { QuestionRecord } from '@/lib/types';

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function QuestionsPage({ params }: { params: { id: string } }) {
  const spaceId = params.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<QuestionRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [spaceName, setSpaceName] = useState<string>('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchQuestions(spaceId), fetchSpacePath(spaceId)]).then(
      ([q, path]) => {
        setRows(q.rows);
        setError(q.error);
        setSpaceName(path.space?.name ?? '');
        setLoading(false);
      },
    );
  }, [spaceId]);

  return (
    <div className="app">
      <Appbar cur="qlog" spaceId={spaceId} />
      <div className="qlog-wrap">
        <div className="qlog-head">
          <Link className="crumb" href={`/space/${spaceId}`}>
            ← {spaceName || '学习路径'}
          </Link>
          <h1>提问记录</h1>
          <p>
            {spaceName ? `${spaceName} · ` : ''}阅读现场的提问，都在这里集中沉淀 · 共{' '}
            {rows.length} 条
          </p>
        </div>

        {loading ? (
          <div className="center-state">
            <div className="ring" />
            <div className="st-text">正在读取提问记录…</div>
          </div>
        ) : error ? (
          <div className="center-state">
            <div className="st-title">读取出错</div>
            <div className="st-text">{error}</div>
          </div>
        ) : rows.length === 0 ? (
          <div className="center-state">
            <div className="st-text">
              还没有提问。读到不懂的地方，划选正文问 AI，问答会沉淀到这里。
            </div>
          </div>
        ) : (
          rows.map((r) => {
            const open = openId === r.id;
            return (
              <div
                key={r.id}
                className={`ql-item${open ? ' open' : ''}`}
                onClick={() => setOpenId(open ? null : r.id)}
              >
                <div className="ql-q">
                  <span className="qm">问</span>
                  <span className="qt">{r.question}</span>
                </div>
                <div className="ql-meta">
                  <span>{formatTime(r.created_at)}</span>
                  <span>·</span>
                  <span
                    className="uref"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/space/${spaceId}/unit/${r.unit_id}`);
                    }}
                  >
                    ↩ {r.unit_title ?? '单元'}
                  </span>
                </div>
                <div className="ql-a">
                  {r.selected_text && <div className="ql-sel">{r.selected_text}</div>}
                  <Markdown remarkPlugins={[remarkGfm]}>{r.answer}</Markdown>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="foot-note">
        提问记录与单元内容相互独立 —— 点单元标签可跳回原文。
      </div>
    </div>
  );
}
