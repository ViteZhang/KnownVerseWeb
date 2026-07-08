import { Reveal } from './reveal';
import { StartCta } from './start-cta';

// 页面主转化点。次 CTA「下载 App」暂为「即将上线」占位（过审后换商店链接）。
export function LandingFinal() {
  return (
    <section id="start" className="final">
      <div className="wrap">
        <Reveal className="card">
          <h2>现在，开一个属于你的空间</h2>
          <p>告诉它你想学什么，几分钟后你就有了一条为你生成的学习路径。</p>
          <div className="cta-row">
            <StartCta className="btn btn-primary btn-lg">
              <svg viewBox="0 0 24 24">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              免费开始使用
            </StartCta>
            <button
              type="button"
              className="btn btn-ghost btn-lg btn-disabled"
              disabled
              aria-disabled="true"
              title="App 即将上线"
            >
              下载 App（即将上线）
            </button>
          </div>
          <p className="subnote">内测期完全免费 · 每人可开多个学习空间 · 无需信用卡</p>
        </Reveal>
      </div>
    </section>
  );
}
