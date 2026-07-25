'use client';
import Link from 'next/link';
import { useState } from 'react';

import { Appbar } from '@/components/appbar';
import { usePaywall } from '@/components/paywall/paywall-provider';
import { redeemCode } from '@/lib/credits';

// 兑换激活码页(《终版》§8④)。「我的」里固定入口,不只在墙里。
// 失败统一提示「无效或已被使用」(与后端一致,不区分原因,防探测码是否存在)。
export default function RedeemPage() {
  const { refreshCredits } = usePaywall();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const onRedeem = async () => {
    const v = code.trim().toUpperCase();
    if (!v || busy) return;
    setBusy(true);
    setMsg(null);
    const r = await redeemCode(v);
    setBusy(false);
    if (r.ok) {
      setMsg({ kind: 'ok', text: `+${r.credits} 积分已到账 —— 进入充值额度,不受上限约束,永不过期。` });
      setCode('');
      refreshCredits();
    } else if (r.reason === 'too_many_attempts') {
      setMsg({ kind: 'err', text: '尝试次数过多,请 10 分钟后再试。' });
    } else if (r.reason === 'not_authenticated') {
      setMsg({ kind: 'err', text: '请先登录再兑换。' });
    } else {
      setMsg({ kind: 'err', text: '激活码无效或已被使用。' });
    }
  };

  return (
    <div className="app">
      <Appbar cur="home" />
      <div className="pane">
        <h2>兑换激活码</h2>
        <p className="sub">
          输入你收到的激活码,积分会立刻到账。
          <b>充值得来的积分永不过期,也不受免费额度上限影响。</b>
        </p>
        <div className="codein">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRedeem();
            }}
            placeholder="KV-XXXX-XXXX-XXXX"
            maxLength={19}
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button onClick={onRedeem} disabled={!code.trim() || busy}>
            {busy ? '兑换中…' : '兑换'}
          </button>
        </div>
        {msg && <div className={`redeem-msg ${msg.kind}`}>{msg.text}</div>}
        <div className="hintbox">
          <b>还没有码?</b>
          <br />
          加创始人微信,告诉要哪个档位(¥9.9 / ¥29.9 / ¥68),转账后收到激活码。目前手工处理,通常几小时内。
          档位与充值流程见 <Link href="/credits">积分说明</Link>。
        </div>
      </div>
    </div>
  );
}
