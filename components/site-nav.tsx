import Link from 'next/link';

import { StartCta } from './landing/start-cta';

// 内容页(定价 / 法务)通用顶栏。与落地页 LandingNav 同款视觉,但链接走绝对路径,
// 不用页内锚点(#how 只在落地页有效)。复用 .landing 作用域下的 .nav 样式。
export function SiteNav() {
  return (
    <nav className="nav">
      <div className="wrap">
        <Link href="/" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          知识<span>宇宙</span>
        </Link>
        <div className="navlinks">
          <Link href="/pricing">定价</Link>
          <Link href="/blog">博客</Link>
          <StartCta className="navcta btn btn-primary">免费开始</StartCta>
        </div>
      </div>
    </nav>
  );
}
