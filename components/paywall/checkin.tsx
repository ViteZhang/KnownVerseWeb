'use client';
import { useState } from 'react';

import { usePaywall } from './paywall-provider';

// 每日签到组件三态(《终版》§8①)。文案必须诚实区分:
//   未签到 → 今日签到 +5;已签到 → 明天再来;免费桶已满 → 发 0 但仍记为已签(不假装发放)。
export function Checkin() {
  const { credits, claim } = usePaywall();
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  if (!credits) return null;

  const cap = credits.freeCap;
  const amt = credits.checkinCredits;
  const capped = credits.free >= cap;
  const checked = credits.checkedToday;

  const onClaim = async () => {
    if (busy || checked) return;
    setBusy(true);
    const r = await claim();
    setBusy(false);
    if (r.ok) {
      setFlash(r.capped ? `已签到,但免费额度已满,本次发放 0` : `签到成功 +${r.granted}`);
      setTimeout(() => setFlash(null), 2200);
    }
  };

  let title: string;
  let desc: string;
  if (checked) {
    title = '今天已签到';
    desc = `明天再来 +${amt}。免费积分不会过期,放心攒。`;
  } else if (capped) {
    title = '免费额度已满';
    desc = `免费额度最多存 ${cap},先用掉一些再来签到。充值额度不受影响。`;
  } else {
    title = `今日签到 +${amt} 积分`;
    desc = `每天来一次,积分自动到账。免费额度最多存 ${cap}。`;
  }

  return (
    <div className={`checkin${capped && !checked ? ' capped' : ''}`}>
      <div className="ci-ic">
        <svg viewBox="0 0 24 24">
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
      </div>
      <div className="ci-tx">
        <div className="t">{flash ?? title}</div>
        <div className="d">{desc}</div>
      </div>
      <button className="ci-btn" onClick={onClaim} disabled={checked || busy}>
        {checked ? '今天已签' : busy ? '…' : '签到'}
      </button>
    </div>
  );
}
