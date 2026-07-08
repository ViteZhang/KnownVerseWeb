import { Reveal } from './reveal';

// 痛点区：6 张「熟悉这些时刻吗」卡 + 一句收束（时间线 vs 知识结构）。
const PAIN: { plain: string; bold: string }[] = [
  { plain: '内容像瀑布流一样往下滚，', bold: '上周学的那段，再也找不到' },
  { plain: 'AI 给的是一坨文档，', bold: '只能复制出去、换个软件读' },
  { plain: '学到哪了全靠记忆，', bold: '每次都要花时间找回进度' },
  { plain: '追问几句，好内容就', bold: '淹进聊天记录，没法回看整理' },
  { plain: '换个会话、上下文满了，', bold: '又得把自己重新介绍一遍' },
  { plain: '想系统学，', bold: '却只有一问一答，没有路径和全貌' },
];

export function LandingProblems() {
  return (
    <section className="problems">
      <div className="wrap">
        <Reveal>
          <div className="sec-eyebrow">熟悉这些时刻吗</div>
          <h2 className="sec">你也这样用 AI 学过东西</h2>
        </Reveal>
        <div className="plist">
          {PAIN.map((p, i) => (
            <Reveal key={i} className="pcard" delay={(i % 3) * 70}>
              <span className="x">
                <svg viewBox="0 0 24 24">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </span>
              <p>
                {p.plain}
                <b>{p.bold}</b>
              </p>
            </Reveal>
          ))}
        </div>
        <Reveal className="pconclusion">
          问题不在 AI，在于聊天框用<b>时间线</b>组织信息——而学习需要的，是
          <b>知识结构 + 进度状态</b>。
        </Reveal>
      </div>
    </section>
  );
}
