import { StartCta } from './start-cta';

// Hero：衬线大标题（定位句）+ 副文案 + 双 CTA + 星群签名 SVG。
// 星群是纯 CSS 动画（float/twinkle 关键帧），prefers-reduced-motion 下由 CSS 停动，无需 JS。
export function LandingHero() {
  return (
    <header className="hero">
      <div className="wrap">
        <div>
          <span className="eyebrow">
            <span className="dot" />
            面向终身学习者 · AI 原生
          </span>
          <h1 className="head">
            把“用 AI 学习”，
            <br />
            变成一个属于你的
            <br />
            <b>知识宇宙</b>
          </h1>
          <p className="sub">
            聊天框适合问答，不适合学习。在这里，每一个想学的东西都是一个独立的学习空间——有
            AI 为你生成的学习路径、可随手划线提问的内容、自动沉淀的问答记录。越学，它越懂你。
          </p>
          <div className="cta-row">
            <StartCta className="btn btn-primary btn-lg">
              <svg viewBox="0 0 24 24">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              免费开始使用
            </StartCta>
            <a className="btn btn-ghost btn-lg" href="#how">
              看它怎么运作
            </a>
          </div>
          <p className="note">
            <b>内测期完全免费</b> · 网页版即刻可用，App 即将登陆 App Store 与 Google Play
          </p>
        </div>

        {/* SIGNATURE: 个人学习星群 */}
        <div className="hero-visual">
          <svg
            className="constellation"
            viewBox="0 0 420 420"
            role="img"
            aria-label="以你为中心、多个学习空间环绕的知识星群示意"
          >
            <ellipse className="orbit" cx="210" cy="210" rx="150" ry="150" />
            <ellipse
              className="orbit"
              cx="210"
              cy="210"
              rx="150"
              ry="60"
              transform="rotate(-24 210 210)"
            />

            <circle className="spark" cx="70" cy="120" r="2" fill="var(--amber)" />
            <circle
              className="spark"
              cx="350"
              cy="150"
              r="1.6"
              fill="var(--amber)"
              style={{ animationDelay: '1.2s' }}
            />
            <circle
              className="spark"
              cx="120"
              cy="350"
              r="2"
              fill="var(--amber)"
              style={{ animationDelay: '2.1s' }}
            />
            <circle
              className="spark"
              cx="330"
              cy="320"
              r="1.6"
              fill="var(--amber)"
              style={{ animationDelay: '.6s' }}
            />

            {/* core: 你 */}
            <g>
              <circle cx="210" cy="210" r="46" fill="var(--ink)" />
              <circle
                cx="210"
                cy="210"
                r="46"
                fill="none"
                stroke="var(--amber)"
                strokeWidth="1.5"
                opacity=".5"
              />
              <text className="node-core" x="210" y="216" textAnchor="middle">
                你
              </text>
            </g>

            {/* space node A · 学科知识 */}
            <g className="starnode float-a">
              <circle cx="210" cy="60" r="30" fill="var(--surface)" stroke="var(--plum)" strokeWidth="1.5" />
              <circle cx="210" cy="60" r="30" fill="var(--plum-wash)" />
              <text className="node-label" x="210" y="64" textAnchor="middle" style={{ fill: 'var(--plum)' }}>
                学科
              </text>
            </g>
            {/* space node B · 职业技能 */}
            <g className="starnode float-b">
              <circle cx="352" cy="262" r="30" fill="var(--surface)" stroke="var(--amber-deep)" strokeWidth="1.5" />
              <circle cx="352" cy="262" r="30" fill="var(--amber-wash)" />
              <text className="node-label" x="352" y="266" textAnchor="middle" style={{ fill: 'var(--amber-deep)' }}>
                技能
              </text>
            </g>
            {/* space node C · 兴趣爱好 */}
            <g className="starnode float-c">
              <circle cx="72" cy="262" r="30" fill="var(--surface)" stroke="var(--sage)" strokeWidth="1.5" />
              <circle cx="72" cy="262" r="30" fill="var(--sage-wash)" />
              <text className="node-label" x="72" y="266" textAnchor="middle" style={{ fill: 'var(--sage)' }}>
                兴趣
              </text>
            </g>

            {/* connective threads core→nodes */}
            <line x1="210" y1="164" x2="210" y2="90" stroke="var(--amber-line)" strokeWidth="1" strokeDasharray="2 5" />
            <line x1="248" y1="238" x2="326" y2="248" stroke="var(--amber-line)" strokeWidth="1" strokeDasharray="2 5" />
            <line x1="172" y1="238" x2="98" y2="248" stroke="var(--amber-line)" strokeWidth="1" strokeDasharray="2 5" />
          </svg>
        </div>
      </div>
    </header>
  );
}
