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
            <br />© 2026 北京筑梦探索科技有限公司
          </div>
        </div>
        <div className="foot-links">
          <div className="foot-col">
            <div className="h">产品</div>
            <a href="#how">它怎么运作</a>
            <a href="#cases">学什么</a>
            <a href="#start">免费开始</a>
          </div>
          <div className="foot-col">
            <div className="h">资源</div>
            <Link href="/blog">博客</Link>
            <a href="#">邀请码</a>
            <a href="#">帮助与反馈</a>
          </div>
          <div className="foot-col">
            <div className="h">法务</div>
            <a href="#">隐私政策</a>
            <a href="#">用户服务协议</a>
            <a href="#">联系我们</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
