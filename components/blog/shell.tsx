// 博客外壳：复用落地页的玻璃导航 + 页脚 + 纸感设计（同挂 .landing 类以继承样式），
// 再加 .blog 作博客专属样式作用域。
import Link from 'next/link';
import type { ReactNode } from 'react';

import { LandingFooter } from '@/components/landing/footer';

export function BlogShell({ children }: { children: ReactNode }) {
  return (
    <div className="landing blog">
      <nav className="nav">
        <div className="wrap">
          <Link className="brand" href="/">
            知识<span>宇宙</span>
          </Link>
          <div className="navlinks">
            <Link href="/">首页</Link>
            <Link href="/blog">博客</Link>
          </div>
        </div>
      </nav>
      <main className="blog-main">
        <div className="wrap">{children}</div>
      </main>
      <LandingFooter />
    </div>
  );
}
