'use client';
import Link from 'next/link';

import { usePaywall } from './paywall-provider';

// 积分余额芯片(《终版》§8①):显示总积分(free+paid),低于 10 变暖红。
// 不出现「本月 / 刷新」等周期字样(纯积分制无月度重置)。点击进积分流水。
export function CreditBar() {
  const { credits } = usePaywall();
  if (!credits) return null;

  const { balance, paid } = credits;
  const low = balance < 10;

  return (
    <Link
      href="/app/ledger"
      className={`credit-chip${low ? ' low' : ''}`}
      title={`免费 ${credits.free} · 充值 ${paid} · 点击查看流水`}
    >
      <span className="cc-coin">积</span>
      <span className="cc-n">{balance}</span>
      <span className="cc-u">积分</span>
    </Link>
  );
}
