import { Reveal } from './reveal';

// 四步运作。第叁步「长按选词问 AI」标记核心差异（keytag）。
export function LandingHow() {
  return (
    <section id="how">
      <div className="wrap">
        <Reveal>
          <div className="sec-eyebrow">它怎么运作</div>
          <h2 className="sec">从一个目标，到一个懂你的学习空间</h2>
          <p className="sec-lead">四步，把“想学点什么”变成可以每天回来的地方。</p>
        </Reveal>
        <div className="steps">
          <Reveal className="step">
            <div className="num">壹</div>
            <div>
              <h3>说出你想学什么</h3>
              <p>
                一句话，或一段话都行。AI 会像一次入学访谈那样，问清你的
                <em>背景、目标和能投入的节奏</em>——问完还给你一张“我对你的理解”确认页，你可以逐条改。
              </p>
            </div>
          </Reveal>
          <Reveal className="step">
            <div className="num">贰</div>
            <div>
              <h3>得到为你生成的学习路径</h3>
              <p>
                阶段化、可编辑的路径，而不是通用课程。<em>它是按你的起点生成的</em>
                ——同样学“投资理财”，给新手和给财务背景的人，是两条不同的路。
              </p>
            </div>
          </Reveal>
          <Reveal className="step">
            <div className="num">叁</div>
            <div>
              <h3>
                在阅读中随手问 <span className="keytag">核心差异</span>
              </h3>
              <p>
                读到不懂的地方，<em>长按选中那几个字</em>，就能问 AI。它结合你的学习档案作答——知道你在学什么、什么水平——而不是给所有人同一个泛泛的答案。
              </p>
            </div>
          </Reveal>
          <Reveal className="step">
            <div className="num">肆</div>
            <div>
              <h3>每一次提问都会沉淀</h3>
              <p>
                问答自动存进这个空间的<em>提问记录</em>，随时回看，不再淹进聊天流；进度自动保存，下次打开直接从上次的地方接着学。
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
