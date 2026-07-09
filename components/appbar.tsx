'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { getSupabase } from '@/lib/supabase/client';
import { signOut } from '@/lib/auth';
import { CreditBar } from '@/components/paywall/credit-bar';
import { usePaywall } from '@/components/paywall/paywall-provider';

type NavKey = 'home' | 'path' | 'qlog';

// 头像下拉菜单项统一样式（Link + button 共用）。
const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '9px 12px',
  fontSize: 13.5,
  color: 'var(--ink-soft)',
  background: 'transparent',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

/** 顶部 appbar（品牌 + 导航 + 头像）。导航的「学习路径/提问记录」需要 spaceId 上下文，
 *  没有时只显示「我的空间」。点头像可登出。 */
export function Appbar({
  cur,
  spaceId,
}: {
  cur: NavKey;
  spaceId?: string;
}) {
  const router = useRouter();
  const { credits } = usePaywall();
  const [initial, setInitial] = useState('·');
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 有订阅记录(会员/宽限/已取消未到期)才显示「订阅管理」入口。
  const hasSub =
    credits != null && ['active', 'past_due', 'canceled'].includes(credits.status);

  const openPortal = async () => {
    setMenuOpen(false);
    try {
      const r = await fetch('/api/portal', { method: 'POST' });
      const b = await r.json().catch(() => ({}));
      if (r.ok && b.url) {
        window.location.href = b.url;
      } else {
        alert(
          b.error === 'portal_unconfigured'
            ? '订阅管理暂未开放。'
            : b.error === 'no_customer'
              ? '未找到你的订阅记录。'
              : '打开订阅管理失败，请稍后再试。',
        );
      }
    } catch {
      alert('打开订阅管理失败，请稍后再试。');
    }
  };

  useEffect(() => {
    getSupabase()
      .auth.getUser()
      .then(({ data }) => {
        const email = data.user?.email ?? '';
        if (email) setInitial(email[0].toUpperCase());
      });
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const onSignOut = async () => {
    await signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <header className="appbar">
      <div className="word">
        知识<span>宇宙</span>
      </div>
      <nav>
        <Link className={cur === 'home' ? 'cur' : ''} href="/app">
          我的空间
        </Link>
        {spaceId && (
          <>
            <Link className={cur === 'path' ? 'cur' : ''} href={`/space/${spaceId}`}>
              学习路径
            </Link>
            <Link
              className={cur === 'qlog' ? 'cur' : ''}
              href={`/space/${spaceId}/questions`}
            >
              提问记录
            </Link>
          </>
        )}
      </nav>
      <div className="spacer" />
      <CreditBar />
      <div ref={wrapRef} style={{ position: 'relative', marginLeft: 14 }}>
        <button
          className="avatar-btn"
          onClick={() => setMenuOpen((v) => !v)}
          title="账户 · 邀请好友 · 设置"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className="avatar">{initial}</span>
          <svg
            className={`caret${menuOpen ? ' open' : ''}`}
            viewBox="0 0 24 24"
            width="14"
            height="14"
            aria-hidden="true"
          >
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 46,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              boxShadow: 'var(--shadow)',
              padding: 6,
              zIndex: 50,
              minWidth: 120,
            }}
          >
            <Link
              href="/app/about"
              onClick={() => setMenuOpen(false)}
              style={menuItemStyle}
            >
              关于我 · 记忆
            </Link>
            <Link
              href="/app/prefs"
              onClick={() => setMenuOpen(false)}
              style={menuItemStyle}
            >
              阅读偏好
            </Link>
            <Link
              href="/app/invite"
              onClick={() => setMenuOpen(false)}
              style={{
                ...menuItemStyle,
                color: 'var(--amber-deep)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              我的邀请码
            </Link>
            {hasSub && (
              <button onClick={openPortal} style={menuItemStyle}>
                订阅管理
              </button>
            )}
            <div
              style={{
                height: 1,
                background: 'var(--line)',
                margin: '5px 6px',
              }}
            />
            <button onClick={onSignOut} style={menuItemStyle}>
              退出登录
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
