'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { getSupabase } from '@/lib/supabase/client';

// 主 CTA「免费开始」。SSR 默认指向 /login —— 无 JS 也是可点的有效链接（§5.1 不阻塞静态渲染）；
// hydration 后若已有会话，改指 /app，让老用户一键回到学习。判断在客户端做，不进服务端渲染路径。
export function StartCta({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [href, setHref] = useState('/login');

  useEffect(() => {
    let alive = true;
    getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (alive && data.session) setHref('/app');
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}
