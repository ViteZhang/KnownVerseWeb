'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Appbar } from '@/components/appbar';
import { getBillingConfigPublic } from '@/lib/billing';
import {
  applyReferral,
  applyResultMessage,
  fetchReferralInfo,
  type ReferralInfo,
} from '@/lib/referral';

// 邀请好友页（纯积分制，§7）：
// 上半——我的持久邀请码 + 复制/分享 + 邀请人数；
// 下半——手动兑换他人邀请码（注册时没填码的老用户也能在此双边各得积分）。
export default function InvitePage() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [refCredits, setRefCredits] = useState(50); // 邀请奖励(积分),取自 billing_config

  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const load = () => {
    fetchReferralInfo().then((r) => {
      if (!r.error) setInfo(r);
      setLoading(false);
    });
  };
  useEffect(() => {
    load();
    getBillingConfigPublic().then((c) => setRefCredits(c.referral_credits));
  }, []);

  const shareText = (c: string) =>
    `我在用「知识宇宙」边学边问。用我的邀请码 ${c} 注册，你和我各得 ${refCredits} 积分。`;

  const copyCode = async (c: string) => {
    try {
      await navigator.clipboard.writeText(c);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用：静默 */
    }
  };

  const shareCode = async (c: string) => {
    const text = shareText(c);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* 用户取消 / 不支持：回退到复制 */
      }
    }
    copyCode(text);
  };

  const onRedeem = async () => {
    if (redeeming || !code.trim()) return;
    setRedeeming(true);
    setRedeemMsg(null);
    const res = await applyReferral(code);
    setRedeeming(false);
    setRedeemMsg(applyResultMessage(res));
    if (res.applied) {
      setCode('');
      load(); // 解锁成功后刷新额度来源
    }
  };

  const alreadyRedeemed = info?.invitedBy != null;

  return (
    <div className="app">
      <Appbar cur="home" />
      <div className="inv-wrap">
        <Link className="crumb" href="/app">
          ← 我的空间
        </Link>

        <div className="inv-panel">
          <h2>邀请好友</h2>
          <p className="inv-hint">
            把邀请码发给朋友，每邀请 1 位成功注册，你和 TA 各得 {refCredits} 积分。
          </p>

          {loading ? (
            <div className="inv-empty">邀请码加载中…</div>
          ) : info?.referralCode ? (
            <>
              <div className="inv-code-row">
                <span className="inv-code">{info.referralCode}</span>
                <div className="inv-code-acts">
                  <button
                    className="inv-ghost"
                    onClick={() => copyCode(info.referralCode!)}
                  >
                    {copied ? '已复制' : '复制'}
                  </button>
                  <button
                    className="inv-solid"
                    onClick={() => shareCode(info.referralCode!)}
                  >
                    分享
                  </button>
                </div>
              </div>

              <div className="inv-stats">
                <Stat label="已成功邀请" value={`${info.invitedCount} 人`} />
              </div>

              <div className="inv-source">
                邀请奖励已进你的积分，可在{' '}
                <Link href="/app/ledger" style={{ color: 'var(--amber-deep)' }}>
                  积分流水
                </Link>{' '}
                查看。
              </div>
            </>
          ) : (
            <div className="inv-empty">邀请码加载失败，请刷新重试。</div>
          )}
        </div>

        {/* 手动兑换他人邀请码：已被邀请过则不再展示（每人限用一次）。 */}
        {!loading && !alreadyRedeemed && (
          <div className="inv-panel">
            <h2>使用邀请码</h2>
            <p className="inv-hint">
              有朋友的邀请码？填在这里，立即为你和 TA 各得 {refCredits} 积分（每人限用一次）。
            </p>
            <div className="inv-redeem">
              <input
                className="field"
                placeholder="粘贴朋友给你的邀请码"
                value={code}
                autoCapitalize="characters"
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onRedeem()}
              />
              <button
                className="primary"
                disabled={redeeming || !code.trim()}
                onClick={onRedeem}
              >
                {redeeming ? '兑换中…' : '兑换'}
              </button>
            </div>
            {redeemMsg && (
              <div className={redeemMsg.ok ? 'inv-ok' : 'inv-err'}>
                {redeemMsg.text}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="inv-stat">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
    </div>
  );
}
