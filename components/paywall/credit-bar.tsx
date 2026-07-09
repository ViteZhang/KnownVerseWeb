'use client';
import { resetHint } from '@/lib/credits';

import { usePaywall } from './paywall-provider';

// 积分余额条(Phase 3 §9):本月还剩 X / 上限,低于 25% 变暖红。数值走服务端真源。
export function CreditBar() {
  const { credits } = usePaywall();
  if (!credits) return null;

  const { balance, monthly, purchased, periodEnd, status } = credits;
  const denom = monthly + purchased; // 进度条分母:月度额度 + 加购
  const pct = denom > 0 ? Math.max(0, Math.min(100, (balance / denom) * 100)) : 0;
  const low = pct < 25;
  const isMember = status === 'active';

  return (
    <div className={`credit-bar${low ? ' low' : ''}`} title="本月积分。仅生成单元与问 AI 消耗。">
      <div className="cb-coin">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8" stroke="var(--amber-deep)" strokeWidth="2" />
          <path
            d="M12 8v8M9.5 10.2c0-1.1 1-1.7 2.5-1.7s2.5.7 2.5 1.6c0 2.2-5 1-5 3.2 0 1 1 1.7 2.5 1.7s2.5-.6 2.5-1.7"
            stroke="var(--amber-deep)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="cb-meta">
        <div className="cb-lab">
          <span>{isMember ? '会员积分' : '本月积分'}</span>
          <span className="cb-num">
            <b>{balance}</b>
            {purchased > 0 ? ` (含加购 ${purchased})` : ''}
          </span>
        </div>
        <div className="cb-track">
          <div className="cb-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="cb-reset">{resetHint(periodEnd)}</div>
    </div>
  );
}
