'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { BillingConfig } from '@/lib/billing';
import { allBillingPriceIds, DISPLAY_PRICES } from '@/lib/billing';
import { openCheckout } from '@/lib/paddle';
import { getSupabase } from '@/lib/supabase/client';

import { LocalizedPrice } from './localized-price';

// 定价页交互卡片(《原型 V1》定价页)。年付/月付切换在客户端;数字来自服务端传入的 billing_config。
// 结账按钮本片先指向 /login(登录后进 /app 才有 Paddle.js Checkout,Slice 4 接);
// 公开定价页的首要职责是 SEO + KYB 审核可达,不在这里起收银台。
const Check = () => (
  <svg viewBox="0 0 24 24">
    <path d="M4 12l5 5L20 6" />
  </svg>
);

export function PricingPlans({ cfg }: { cfg: BillingConfig }) {
  const [bill, setBill] = useState<'year' | 'month'>('year');
  const isYear = bill === 'year';
  const allPriceIds = allBillingPriceIds(cfg);

  // 登录态(客户端判断,不进 SSG 渲染路径):有会话才走结账,否则去登录。
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  // 测试价格覆盖:?price=<id> 时用它下单(联调 $0.1 用,不写死进代码)。
  const [testPrice, setTestPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (alive && data.session?.user) {
          setUser({ id: data.session.user.id, email: data.session.user.email ?? undefined });
        }
      });
    // 用 location.search 而非 useSearchParams,避免把 SSG 页拖成动态渲染。
    const p = new URLSearchParams(window.location.search).get('price');
    if (p) setTestPrice(p);
    return () => {
      alive = false;
    };
  }, []);

  const proPriceId = testPrice ?? (isYear ? cfg.price_pro_yearly : cfg.price_pro_monthly);

  async function handleUpgrade() {
    if (!user) {
      window.location.href = '/login?next=/pricing';
      return;
    }
    if (!proPriceId) {
      alert('价格尚未配置(billing_config 缺 price id)。');
      return;
    }
    setBusy(true);
    try {
      await openCheckout({ priceId: proPriceId, userId: user.id, email: user.email });
    } catch (e) {
      alert('结账初始化失败:' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="toggle">
        <div className="seg2">
          <div
            className="knob"
            style={{
              width: 'calc(50% - 4px)',
              left: isYear ? 4 : 'calc(50%)',
            }}
          />
          <button className={isYear ? 'on' : ''} onClick={() => setBill('year')}>
            年付<span className="save-tag">省 35%</span>
          </button>
          <button className={!isYear ? 'on' : ''} onClick={() => setBill('month')}>
            月付
          </button>
        </div>
      </div>

      <div className="plans">
        <div className="plan free">
          <div className="pname">免费</div>
          <div className="amt">
            <span className="big">$0</span>
          </div>
          <div className="permo">一直免费,够你认真学一阵</div>
          <ul>
            <li>
              <Check />
              <span>
                <span className="k">每月 {cfg.free_monthly_credits} 积分</span>(约 6 次单元 + 30 次问 AI)
              </span>
            </li>
            <li>
              <Check />
              <span>
                <span className="k">2 个学习空间</span>(邀请可再解锁)
              </span>
            </li>
            <li>
              <Check />
              <span>全部功能 —— 与会员完全一致</span>
            </li>
          </ul>
          <Link href="/login" className="cta" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            免费开始
          </Link>
        </div>

        <div className="plan pro">
          <div className="rib">最划算</div>
          <div className="pname">Pro 会员</div>
          <div className="amt">
            <span className="big">
              <LocalizedPrice
                priceId={isYear ? cfg.price_pro_yearly : cfg.price_pro_monthly}
                allIds={allPriceIds}
                fallback={isYear ? DISPLAY_PRICES.proYearly : DISPLAY_PRICES.proMonthly}
              />
            </span>
            <span className="per">{isYear ? '/年' : '/月'}</span>
          </div>
          <div className="permo">
            {isYear ? '按年一次性计费 · 比月付更省 · 随时退订' : '灵活月付 · 随时退订'}
          </div>
          <ul>
            <li>
              <Check />
              <span>
                <span className="k">每月 {cfg.member_monthly_credits} 积分</span> —— 约 10 倍学习深度
              </span>
            </li>
            <li>
              <Check />
              <span>
                <span className="k">空间上限 {cfg.member_space_cap}</span> —— 想开多少方向都行
              </span>
            </li>
            <li>
              <Check />
              <span>全部功能(和免费一样,只是量更足)</span>
            </li>
            <li>
              <Check />
              <span>积分随时可加购,一键退订</span>
            </li>
          </ul>
          <button className="cta" onClick={handleUpgrade} disabled={busy}>
            {busy ? '正在打开结账…' : testPrice ? '测试结账($0.1)' : '升级到 Pro'}
          </button>
        </div>
      </div>
    </>
  );
}
