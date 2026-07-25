// 公开积分说明页(《终版》§8⑥):替代原定价页。SSR/ISR + SEO 资产。
// 正文全部在 HTML 源码里(可被 curl / 搜索引擎抓取)。无在线支付,充值走线下微信 + 激活码。
import type { Metadata } from 'next';

import { LandingFooter } from '@/components/landing/footer';
import { SiteNav } from '@/components/site-nav';
import {
  CREDIT_PACKS,
  GOAL_CREDIT_ANCHOR,
  getBillingConfigPublic,
  type BillingConfig,
} from '@/lib/billing';

// billing_config 极少变;每小时 ISR 一次,兼顾 SEO 静态化与「改数字即生效」。
export const revalidate = 3600;

export const metadata: Metadata = {
  title: '积分说明 · 功能全部开放',
  description:
    '知识宇宙:所有功能对每个人开放,积分只决定你学多少。注册送 150 积分,每天签到 +5,邀请好友双方各 +50。建空间 50 / 生成单元 10 / 问 AI 1,阅读与提问记录不花积分。充值走激活码。',
  alternates: { canonical: '/credits' },
  openGraph: {
    title: '知识宇宙 · 积分说明',
    description: '功能全部开放,只有学多少的区别。',
    url: '/credits',
    type: 'website',
  },
};

export default async function CreditsPage() {
  const cfg: BillingConfig = await getBillingConfigPublic();

  return (
    <div className="landing">
      <SiteNav />

      <main className="cr-main">
        <div className="cr-hero">
          <div className="cr-eb">积分说明</div>
          <h1>
            功能全部开放。
            <br />
            只有<em>学多少</em>的区别。
          </h1>
          <p>
            划词问 AI、个性化生成、导入建课——所有能力对每个人一样。积分决定的只是你学的量。
          </p>
        </div>

        <div className="cr-wrap">
          {/* 积分花在哪 */}
          <section className="cr-sec">
            <div className="cr-h">积分花在哪</div>
            <div className="cr-tab">
              <div className="cr-row head">
                <div>动作</div>
                <div className="r">积分</div>
              </div>
              <div className="cr-row">
                <div className="lab">新建一个学习空间(访谈 + 路径)</div>
                <div className="val">{cfg.cost_space_creation}</div>
              </div>
              <div className="cr-row">
                <div className="lab">生成一个学习单元</div>
                <div className="val">{cfg.cost_unit_generation}</div>
              </div>
              <div className="cr-row">
                <div className="lab">划词问 AI 一次</div>
                <div className="val">{cfg.cost_ask_ai}</div>
              </div>
              <div className="cr-row">
                <div className="lab">阅读 · 提问记录 · 学习档案</div>
                <div className="val free">免费</div>
              </div>
            </div>
            <div className="cr-anchor">
              <b>一个学习目标从头走完,大约 {GOAL_CREDIT_ANCHOR} 积分。</b>
              <br />= 建空间 {cfg.cost_space_creation} + 约 24 个单元 240 + 几十次追问 50。心里有这个数,就知道该充多少。
            </div>
          </section>

          {/* 积分从哪来 */}
          <section className="cr-sec">
            <div className="cr-h">积分从哪来</div>
            <div className="cr-tab">
              <div className="cr-row head">
                <div>来源</div>
                <div className="r">积分</div>
              </div>
              <div className="cr-row">
                <div className="lab">注册就送(一次性)</div>
                <div className="val free">{cfg.welcome_credits}</div>
              </div>
              <div className="cr-row">
                <div className="lab">每天签到</div>
                <div className="val free">+{cfg.daily_checkin_credits}</div>
              </div>
              <div className="cr-row">
                <div className="lab">邀请一位朋友(双方各得)</div>
                <div className="val free">+{cfg.referral_credits}</div>
              </div>
              <div className="cr-row">
                <div className="lab">充值(激活码)</div>
                <div className="val">300 起</div>
              </div>
            </div>
            <div className="cr-anchor">
              免费积分<b>不会过期,也不会被清零</b>,只是最多存到 {cfg.free_balance_cap} —— 存满了就先花掉一些再继续签到。
              <br />
              <b>充值的积分没有上限,永不过期。</b>
            </div>
          </section>

          {/* 充值档位 */}
          <section className="cr-sec">
            <div className="cr-h">充值档位</div>
            <div className="cr-packs">
              {CREDIT_PACKS.map((p) => (
                <div className={`cr-pack${p.hero ? ' hero' : ''}`} key={p.price}>
                  <div className="p">{p.price}</div>
                  <div className="c">{p.credits} 积分</div>
                  <div className="d">{p.note}</div>
                </div>
              ))}
            </div>
            <div className="cr-buy">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="cr-qr" src="/wechat-qr.png" alt="扫码加微信充值" width={96} height={96} />
              <div className="cr-bt">
                <b>怎么充值</b>
                <ol>
                  <li>扫码加创始人微信,说要哪个档位</li>
                  <li>转账</li>
                  <li>收到激活码</li>
                  <li>在「我的 → 兑换激活码」输入,立即到账</li>
                </ol>
                目前由创始人手工处理,通常几小时内。这是个小团队做的产品,谢谢你的耐心。
              </div>
            </div>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
