'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { getSupabase } from '@/lib/supabase/client';
import { signOut } from '@/lib/auth';

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
  const [initial, setInitial] = useState('·');
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <button
          className="avatar"
          onClick={() => setMenuOpen((v) => !v)}
          title="账户"
        >
          {initial}
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
