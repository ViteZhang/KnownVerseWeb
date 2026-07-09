import type { ReactNode } from 'react';

import { LandingFooter } from '@/components/landing/footer';
import { SiteNav } from '@/components/site-nav';

// 法务页通用外壳:复用 .landing 作用域下的顶栏/页脚 + .legal prose 容器。
export function LegalShell({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="landing">
      <SiteNav />
      <main className="page-main">
        <article className="legal">
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <div className="updated">最后更新:{updated}</div>
          {children}
        </article>
      </main>
      <LandingFooter />
    </div>
  );
}
