import { StartCta } from './start-cta';

// 顶部导航：sticky + 毛玻璃；移动端只留品牌 + CTA（次要锚点在 CSS 里隐藏）。
export function LandingNav() {
  return (
    <nav className="nav">
      <div className="wrap">
        <div className="brand">
          知识<span>宇宙</span>
        </div>
        <div className="navlinks">
          <a href="#how">它怎么运作</a>
          <a href="#cases">学什么</a>
          <a href="/blog">博客</a>
          <StartCta className="navcta btn btn-primary">免费开始</StartCta>
        </div>
      </div>
    </nav>
  );
}
