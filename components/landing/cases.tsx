import { Reveal } from './reveal';

// 真实用例：三张卡（职业/思辨/技能）+「创始人自己在用」一句。
const CASES: {
  tag: string;
  tagCls: 'career' | 'think' | 'skill';
  title: string;
  desc: string;
  pct: number;
}[] = [
  {
    tag: '职业转型',
    tagCls: 'career',
    title: '转型 AI 产品经理',
    desc: '从现有产品经验出发，AI 生成一条补齐 AI 认知与实战的路径，边读边把不懂的概念问透。',
    pct: 62,
  },
  {
    tag: '自我成长',
    tagCls: 'think',
    title: '阳明心学',
    desc: '思辨型内容，不是背知识点，而是顺着“知行合一”一层层追问，把经典读进自己的处境里。',
    pct: 40,
  },
  {
    tag: '技能',
    tagCls: 'skill',
    title: '成人自学钢琴',
    desc: '从零起步的技能路径，拆成可练的小单元，卡在某个乐理或指法上，随手就能问。',
    pct: 28,
  },
];

export function LandingCases() {
  return (
    <section id="cases">
      <div className="wrap">
        <Reveal>
          <div className="sec-eyebrow">学什么都行</div>
          <h2 className="sec">无论你想学什么，都给它一个空间</h2>
          <p className="sec-lead">
            技能、应试、兴趣、自我成长——多个学习空间并行，档案、路径、进度、提问记录互不干扰。
          </p>
        </Reveal>
        <div className="cases">
          {CASES.map((c, i) => (
            <Reveal key={c.title} className="case" delay={(i % 3) * 70}>
              <span className={`tag ${c.tagCls}`}>{c.tag}</span>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
              <div className="miniprog">
                <div className="bar">
                  <i style={{ width: `${c.pct}%` }} />
                </div>
                <span className="n">{c.pct}%</span>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="cases-foot">
          这三个空间，正是<b>创始人自己</b>在知识宇宙里学的——产品从一个真实的学习工作流长出来。
        </Reveal>
      </div>
    </section>
  );
}
