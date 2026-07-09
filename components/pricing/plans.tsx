'use client';
import Link from 'next/link';
import { useState } from 'react';

import type { BillingConfig } from '@/lib/billing';
import { DISPLAY_PRICES } from '@/lib/billing';

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
            <span className="big">{isYear ? DISPLAY_PRICES.proYearly : DISPLAY_PRICES.proMonthly}</span>
            <span className="per">{isYear ? '/年' : '/月'}</span>
          </div>
          <div className="permo">
            {isYear
              ? `约 ${DISPLAY_PRICES.proYearlyPerMonth}/月 · 比月付省约 4 个月`
              : '灵活月付 · 随时退订'}
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
          <Link href="/login" className="cta" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            升级到 Pro
          </Link>
        </div>
      </div>
    </>
  );
}
