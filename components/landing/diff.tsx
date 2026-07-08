import { Reveal } from './reveal';

// 差异带（黑底强调）：AI 带着「对你的了解」回答，与通用聊天框拉开区隔。
export function LandingDiff() {
  return (
    <section className="diff">
      <div className="wrap">
        <Reveal>
          <div className="sec-eyebrow">为什么不是又一个聊天框</div>
          <h2>
            同一个问题，AI 带着<b>“它对你的了解”</b>回答，
            <br />
            而不是给一万个人同一段话。
          </h2>
          <p>
            你的背景、目标、水平、已经掌握和还薄弱的地方，都会随着你学习不断积累，成为每一次生成和答疑的上下文。用得越久，它越懂你——这是聊天框天生给不了的。
          </p>
        </Reveal>
      </div>
    </section>
  );
}
