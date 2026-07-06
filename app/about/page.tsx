'use client';
import { useEffect, useRef, useState } from 'react';

import { Appbar } from '@/components/appbar';
import {
  entriesToMemory,
  fetchUserMemory,
  GROUP_LABEL,
  GROUP_ORDER,
  memoryToEntries,
  saveUserMemory,
  type MemoryEntry,
  type MemoryGroup,
  type UserMemory,
} from '@/lib/user-memory';

type Row = MemoryEntry & { editing?: boolean };

export default function AboutMemoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [base, setBase] = useState<UserMemory>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle');
  const idSeq = useRef(0);

  useEffect(() => {
    fetchUserMemory().then((r) => {
      setBase(r.memory);
      setRows(
        memoryToEntries(r.memory).map((e) => ({ ...e, id: `r${idSeq.current++}` })),
      );
      setError(r.error);
      setLoading(false);
    });
  }, []);

  const dirty = () => setStatus('idle');

  const setValue = (id: string, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));
    dirty();
  };
  const toggleEdit = (id: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, editing: !r.editing } : r)),
    );
  };
  const remove = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    dirty();
  };
  const add = (group: MemoryGroup) => {
    const id = `r${idSeq.current++}`;
    setRows((prev) => [...prev, { id, group, value: '', editing: true }]);
    dirty();
  };

  const onSave = async () => {
    setSaving(true);
    const cleaned = rows
      .map((r) => ({ id: r.id, group: r.group, value: r.value }))
      .filter((r) => r.value.trim());
    const memory = entriesToMemory(cleaned, base);
    const res = await saveUserMemory(memory);
    setSaving(false);
    if (res.ok) {
      setBase(memory);
      // 丢弃空行，退出编辑态。
      setRows((prev) =>
        prev.filter((r) => r.value.trim()).map((r) => ({ ...r, editing: false })),
      );
      setStatus('saved');
    } else {
      setStatus('failed');
    }
  };

  return (
    <div className="app">
      <Appbar cur="home" />
      <div className="mm-wrap">
        <div className="mm-head">
          <h1>关于我</h1>
          <p>
            这些是 AI 逐渐了解到的关于你的信息。你划词问 AI 时，它会带着这些作答，让回答更贴合你。
          </p>
          <div className="note">
            这里的记忆<b>跨所有空间共享</b>——它记住的是「你是谁、怎么学」，不属于某一个具体空间。保存后即时生效，手机端也会同步。
          </div>
        </div>

        {loading ? (
          <div className="center-state">
            <div className="ring" />
            <div className="st-text">正在读取你的记忆…</div>
          </div>
        ) : error ? (
          <div className="center-state">
            <div className="st-title">读取出错</div>
            <div className="st-text">{error}</div>
          </div>
        ) : (
          <>
            {GROUP_ORDER.map((group) => {
              const items = rows.filter((r) => r.group === group);
              return (
                <div className="mm-group" key={group}>
                  <div className="mm-gh">{GROUP_LABEL[group]}</div>
                  {items.map((r) => (
                    <div
                      className={`mm-item${r.editing ? ' editing' : ''}`}
                      key={r.id}
                    >
                      {r.editing ? (
                        <textarea
                          className="txt"
                          rows={1}
                          autoFocus
                          value={r.value}
                          placeholder="写一条…"
                          onChange={(e) => setValue(r.id, e.target.value)}
                        />
                      ) : (
                        <div className="txt">{r.value}</div>
                      )}
                      <div className="acts">
                        <button
                          className="act"
                          title={r.editing ? '完成' : '编辑'}
                          onClick={() => toggleEdit(r.id)}
                        >
                          {r.editing ? '✓' : '✎'}
                        </button>
                        <button
                          className="act del"
                          title="删除"
                          onClick={() => remove(r.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                  <button className="mm-add" onClick={() => add(group)}>
                    <span className="plus">＋</span>添加一条
                  </button>
                </div>
              );
            })}

            <div className="mm-save">
              <button className="primary" disabled={saving} onClick={onSave}>
                {saving ? '正在保存…' : '保存改动'}
              </button>
              <span
                className={`mm-status${status === 'saved' ? ' saved' : status === 'failed' ? ' failed' : ''}`}
              >
                {status === 'saved'
                  ? '已保存 · 手机端同步生效'
                  : status === 'failed'
                    ? '保存失败，请重试'
                    : '改动后记得保存'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
