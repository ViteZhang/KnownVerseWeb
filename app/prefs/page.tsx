'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Appbar } from '@/components/appbar';
import {
  DEFAULT_PREFS,
  fetchReadingPrefs,
  FONT_SIZES,
  LINE_HEIGHTS,
  saveReadingPrefs,
  WIDTHS,
  type ReadingPrefs,
} from '@/lib/reading-prefs';

const SIZE_LABELS = ['小', '中', '大'];
const WIDTH_LABELS = ['窄', '标准', '宽'];
const LH_LABELS = ['紧凑', '标准', '宽松'];

export default function PrefsPage() {
  const [prefs, setPrefs] = useState<ReadingPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    fetchReadingPrefs().then((p) => {
      setPrefs(p);
      setLoading(false);
    });
  }, []);

  const update = (patch: Partial<ReadingPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setStatus('saving');
    saveReadingPrefs(next).then((r) => setStatus(r.ok ? 'saved' : 'idle'));
  };

  return (
    <div className="app">
      <Appbar cur="home" />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 28px' }}>
        <Link className="crumb" href="/about">
          ← 关于我
        </Link>
      </div>
      <div className="rp-wrap">
        <div className="rp-panel">
          <h2>阅读偏好</h2>
          <div className="sub">只影响网页端阅读，随账号保存</div>

          <div className="rp-field">
            <div className="fl">正文字号</div>
            <div className="seg">
              {FONT_SIZES.map((s, i) => (
                <button
                  key={s}
                  className={prefs.fontSize === s ? 'on' : ''}
                  disabled={loading}
                  onClick={() => update({ fontSize: s })}
                >
                  {SIZE_LABELS[i]}
                </button>
              ))}
            </div>
          </div>

          <div className="rp-field">
            <div className="fl">栏宽</div>
            <div className="seg">
              {WIDTHS.map((w, i) => (
                <button
                  key={w}
                  className={prefs.width === w ? 'on' : ''}
                  disabled={loading}
                  onClick={() => update({ width: w })}
                >
                  {WIDTH_LABELS[i]}
                </button>
              ))}
            </div>
          </div>

          <div className="rp-field">
            <div className="fl">行距</div>
            <div className="seg">
              {LINE_HEIGHTS.map((lh, i) => (
                <button
                  key={lh}
                  className={prefs.lineHeight === lh ? 'on' : ''}
                  disabled={loading}
                  onClick={() => update({ lineHeight: lh })}
                >
                  {LH_LABELS[i]}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`rp-status${status === 'saved' ? ' saved' : ''}`}
          >
            {status === 'saving'
              ? '正在保存…'
              : status === 'saved'
                ? '已保存 · 换设备也会带着这套设置'
                : '调整即时保存'}
          </div>

          <div className="kbd-list">
            <div className="kh">键盘快捷键</div>
            <div className="kbd-row">
              <span>选中文字后问 AI</span>
              <b>⌘ K</b>
            </div>
            <div className="kbd-row">
              <span>下一 / 上一单元</span>
              <b>J / K</b>
            </div>
            <div className="kbd-row">
              <span>收起 / 展开目录</span>
              <b>[</b>
            </div>
            <div className="kbd-row">
              <span>关闭问 AI 抽屉</span>
              <b>Esc</b>
            </div>
          </div>
        </div>

        <div className="rp-preview">
          <div className="pv-label">实时预览</div>
          <div
            className="pv-body"
            style={{ maxWidth: prefs.width }}
          >
            <h3 style={{ fontSize: prefs.fontSize + 5.5 }}>RICE 的四个维度</h3>
            <p style={{ fontSize: prefs.fontSize, lineHeight: prefs.lineHeight }}>
              <b>Reach（触达）</b>：这个需求在一个周期内会影响多少用户。它逼你回答一个常被跳过的问题：这件事到底关系到多少人。
            </p>
            <p style={{ fontSize: prefs.fontSize, lineHeight: prefs.lineHeight }}>
              <b>Confidence（信心）</b>：你对前面这些估计有多大把握。它是一个百分比，作用是给那些「听起来很美但证据很薄」的需求降权。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
