import Link from 'next/link';

// 页脚：品牌 + 公司名 + 产品/资源/法务三列。
// 法务与联系为接入位（§2 创始人后补真实页面），暂用占位链接。
export function LandingFooter() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-brand">
          知识<span>宇宙</span>
          <div className="co">
            把用 AI 学习，变成有结构、有进度、能沉淀的个人学习空间。
          </div>
        </div>
        <div className="foot-links">
          <div className="foot-col">
            <div className="h">产品</div>
            {/* 绝对路径:页脚在定价/法务页复用时,页内锚点用 /#... 才能跳回落地页对应分区。 */}
            <a href="/#how">它怎么运作</a>
            <a href="/#cases">学什么</a>
            <Link href="/pricing">定价</Link>
          </div>
          <div className="foot-col">
            <div className="h">资源</div>
            <Link href="/blog">博客</Link>
            <a href="/#start">免费开始</a>
            <a href="#">帮助与反馈</a>
          </div>
          <div className="foot-col">
            <div className="h">法务</div>
            <Link href="/privacy">隐私政策</Link>
            <Link href="/terms">用户服务协议</Link>
            <Link href="/refunds">退款政策</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
