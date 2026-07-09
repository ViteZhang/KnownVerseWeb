// 公开定价页(《Phase3》§10):SSR/ISR + SEO 资产。
// 正文全部在 HTML 源码里(可被 curl / 搜索引擎 / Paddle 审核抓取);仅年付/月付切换下沉到客户端。
import type { Metadata } from 'next';

import { PricingJsonLd } from '@/components/pricing/json-ld';
import { PricingPlans } from '@/components/pricing/plans';
import { LandingFooter } from '@/components/landing/footer';
import { SiteNav } from '@/components/site-nav';
import {
  DISPLAY_PRICES,
  getBillingConfigPublic,
  type BillingConfig,
} from '@/lib/billing';

// billing_config 极少变;每小时 ISR 一次,兼顾 SEO 静态化与「改数字即生效」。
export const revalidate = 3600;

export const metadata: Metadata = {
  title: '定价 · 功能从不上锁',
  description:
    '知识宇宙 Pro:功能对免费用户全开,付费只解决「你想学多少」——更多学习空间与更多积分。免费每月 80 积分 + 2 空间;Pro 每月 800 积分 + 50 空间。由 Paddle 全球代收开票,一键退订。',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: '知识宇宙 · 定价',
    description: '功能从不上锁。会员给你更多空间和更多积分。',
    url: '/pricing',
    type: 'website',
  },
};

const Check = () => (
  <svg viewBox="0 0 24 24">
    <path d="M4 12l5 5L20 6" />
  </svg>
);

export default async function PricingPage() {
  const cfg: BillingConfig = await getBillingConfigPublic();

  return (
    <div className="landing pricing">
      <SiteNav />
      <PricingJsonLd cfg={cfg} />

      <main className="page-main">
        <div className="price-hero">
          <div className="eb">知识宇宙 Pro</div>
          <h1>
            功能从不上锁。
            <br />
            会员给你更多<em>空间</em>和更多<em>积分</em>。
          </h1>
          <p>
            划词问 AI、个性化生成、导入建课……所有能力对免费用户全开。付费只解决一件事:你想学多少。
          </p>
          <div className="legend">
            <span>
              1 次问 AI = <b>{cfg.cost_ask_ai} 积分</b>
            </span>
            <span className="sep">|</span>
            <span>
              生成 1 个单元 = <b>{cfg.cost_unit_generation} 积分</b>
            </span>
          </div>
        </div>

        <PricingPlans cfg={cfg} />

        <div className="addons">
          <div className="h">不想订阅?按需加购</div>
          <div className="addgrid">
            <div className="addcard">
              <div className="ai">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="8" />
                  <path d="M12 8v8M9 11h6" />
                </svg>
              </div>
              <div className="at">
                <div className="t">积分包</div>
                <div className="d">+{cfg.credit_pack_amount} 积分 · 持久不重置,用完为止</div>
              </div>
              <div className="ap">
                {DISPLAY_PRICES.creditPack}
                <small>起</small>
              </div>
            </div>
            <div className="addcard">
              <div className="ai">
                <svg viewBox="0 0 24 24">
                  <rect x="4" y="5" width="6" height="6" rx="1.5" />
                  <rect x="14" y="5" width="6" height="6" rx="1.5" />
                  <path d="M7 15v5M4.5 17.5h5" />
                </svg>
              </div>
              <div className="at">
                <div className="t">空间包</div>
                <div className="d">+{cfg.space_pack_amount} 个空间 · 一次性,不订阅也能开</div>
              </div>
              <div className="ap">{DISPLAY_PRICES.spacePack}</div>
            </div>
          </div>
        </div>

        <div className="compare">
          <div className="h">免费 vs 会员 · 只有两处不同</div>
          <div className="ctab">
            <div className="crow head">
              <div>&nbsp;</div>
              <div className="c-free">免费</div>
              <div className="c-pro">Pro 会员</div>
            </div>
            <div className="crow">
              <div className="c-lab">每月积分</div>
              <div className="c-free">{cfg.free_monthly_credits}</div>
              <div className="c-pro">{cfg.member_monthly_credits}</div>
            </div>
            <div className="crow">
              <div className="c-lab">空间上限</div>
              <div className="c-free">2</div>
              <div className="c-pro">{cfg.member_space_cap}</div>
            </div>
            {[
              '入学访谈 · 路径生成',
              '划词问 AI(灵魂交互)',
              '单元生成 · 提问记录',
              '多格式导入建课',
            ].map((label) => (
              <div className="crow same" key={label}>
                <div className="c-lab">{label}</div>
                <div className="c-free">
                  <span className="chk">
                    <Check />
                  </span>
                </div>
                <div className="c-pro">
                  <span className="chk">
                    <Check />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="price-foot">
          由 <b>Paddle</b> 代收全球税费并开票,支持卡 / PayPal / Apple·Google Pay / 支付宝 / 微信 · 一键退订。
          <br />
          价格因地区自动本地化展示。订阅到期自动续费,可随时在「我的」里一键取消。
          <br />
          详见 <a href="/terms" style={{ color: 'var(--ink-soft)' }}>服务条款</a> 与{' '}
          <a href="/refunds" style={{ color: 'var(--ink-soft)' }}>退款政策</a>。
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
