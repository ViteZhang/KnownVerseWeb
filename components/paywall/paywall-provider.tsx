'use client';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getCreditStatus, claimDaily, type CreditStatus } from '@/lib/credits';

// 纯积分制付费墙(《终版》§8③):唯一一种墙 = 积分不足,三个出口。
// 无会员/订阅/空间墙;余额条读它、积分墙由它弹、签到也走它(全局余额刷新一处收口)。
type WallCtx = { balance: number; needed: number };
type PaywallState = { kind: 'none' } | { kind: 'credit'; ctx: WallCtx };

type PaywallApi = {
  credits: CreditStatus | null;
  refreshCredits: () => void;
  claim: () => Promise<{ ok: boolean; granted: number; capped: boolean }>;
  openCreditWall: (ctx: WallCtx) => void;
};

const Ctx = createContext<PaywallApi | null>(null);

export function usePaywall(): PaywallApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePaywall 必须在 PaywallProvider 内使用');
  return v;
}

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [credits, setCredits] = useState<CreditStatus | null>(null);
  const [wall, setWall] = useState<PaywallState>({ kind: 'none' });

  const refreshCredits = useCallback(() => {
    getCreditStatus().then(setCredits);
  }, []);

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  const claim = useCallback(async () => {
    const r = await claimDaily();
    if (r.ok) refreshCredits();
    return { ok: r.ok, granted: r.granted, capped: r.capped };
  }, [refreshCredits]);

  const openCreditWall = useCallback((ctx: WallCtx) => setWall({ kind: 'credit', ctx }), []);
  const close = useCallback(() => setWall({ kind: 'none' }), []);

  const api = useMemo<PaywallApi>(
    () => ({ credits, refreshCredits, claim, openCreditWall }),
    [credits, refreshCredits, claim, openCreditWall],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {wall.kind === 'credit' && <CreditWall ctx={wall.ctx} onClose={close} />}
    </Ctx.Provider>
  );
}

// ── 积分墙(§8③):三个出口顺序固定 —— 兑换激活码(主)/ 加微信充值 / 明天签到。 ──
function CreditWall({ ctx, onClose }: { ctx: WallCtx; onClose: () => void }) {
  const router = useRouter();
  const title =
    ctx.needed >= 50
      ? '积分不够新建空间'
      : ctx.needed >= 10
        ? '积分不够生成这一单元'
        : '积分不够问这一次';

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <Scrim onClose={onClose}>
      <div className="pw-cap">
        <div className="pw-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--amber-deep)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 8v4" />
            <path d="M12 15.5h.01" />
          </svg>
        </div>
        <h3>{title}</h3>
        <p>
          这次需要 <b>{ctx.needed} 积分</b>,你还剩 <b>{ctx.balance}</b>。
        </p>
        <span className="pw-keep">✓ 已生成的内容、提问记录照常看,功能没被锁</span>
      </div>
      <div className="pw-opts">
        <button className="pw-opt hero" onClick={() => go('/app/redeem')}>
          <div className="pw-oic">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 7L9 18l-5-5" />
            </svg>
          </div>
          <div className="pw-otx">
            <div className="t">兑换激活码</div>
            <div className="d">已经有码?现在输入,积分立即到账</div>
          </div>
        </button>
        <button className="pw-opt" onClick={() => go('/credits')}>
          <div className="pw-oic">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h16v11H7l-3 3z" />
              <path d="M8 10h8" />
            </svg>
          </div>
          <div className="pw-otx">
            <div className="t">加微信充值</div>
            <div className="d">目前由创始人手工处理:说明档位 → 转账 → 发你激活码</div>
          </div>
        </button>
        <button className="pw-opt" onClick={onClose}>
          <div className="pw-oic">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
            </svg>
          </div>
          <div className="pw-otx">
            <div className="t">明天签到 +5</div>
            <div className="d">免费额度每天都会长,不充值也能继续学</div>
          </div>
        </button>
      </div>
      <div className="pw-foot">
        <button onClick={onClose}>先去读已有的内容</button>
      </div>
    </Scrim>
  );
}

function Scrim({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="pw-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pw-sheet" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}
