'use client';
import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getBillingConfigPublic, DISPLAY_PRICES, type BillingConfig } from '@/lib/billing';
import { getCreditStatus, type CreditStatus } from '@/lib/credits';
import { openCheckout } from '@/lib/paddle';
import { getSupabase } from '@/lib/supabase/client';

// 付费墙上下文(Phase 3 §9):余额条读它、积分墙/空间墙由它弹、结账 CTA 走它。
type WallCtx = { balance: number; needed: number };
type PaywallState =
  | { kind: 'none' }
  | { kind: 'credit'; ctx: WallCtx }
  | { kind: 'space' };

type PaywallApi = {
  credits: CreditStatus | null;
  refreshCredits: () => void;
  isMember: boolean;
  openCreditWall: (ctx: WallCtx) => void;
  openSpaceWall: () => void;
};

const Ctx = createContext<PaywallApi | null>(null);

export function usePaywall(): PaywallApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePaywall 必须在 PaywallProvider 内使用');
  return v;
}

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [cfg, setCfg] = useState<BillingConfig | null>(null);
  const [credits, setCredits] = useState<CreditStatus | null>(null);
  const [wall, setWall] = useState<PaywallState>({ kind: 'none' });

  const refreshCredits = useCallback(() => {
    getCreditStatus().then(setCredits);
  }, []);

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session?.user) {
          setUser({ id: data.session.user.id, email: data.session.user.email ?? undefined });
        }
      });
    getBillingConfigPublic().then(setCfg);
    refreshCredits();
  }, [refreshCredits]);

  const isMember = credits?.status === 'active';

  const openCreditWall = useCallback((ctx: WallCtx) => setWall({ kind: 'credit', ctx }), []);
  const openSpaceWall = useCallback(() => setWall({ kind: 'space' }), []);
  const close = useCallback(() => setWall({ kind: 'none' }), []);

  const checkout = useCallback(
    (priceId: string | null) => {
      if (!priceId) {
        alert('该商品尚未配置价格。');
        return;
      }
      if (!user) {
        window.location.href = '/login';
        return;
      }
      openCheckout({ priceId, userId: user.id, email: user.email }).catch((e) =>
        alert('结账初始化失败:' + (e instanceof Error ? e.message : String(e))),
      );
    },
    [user],
  );

  const api = useMemo<PaywallApi>(
    () => ({ credits, refreshCredits, isMember, openCreditWall, openSpaceWall }),
    [credits, refreshCredits, isMember, openCreditWall, openSpaceWall],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {wall.kind === 'credit' && (
        <CreditWall
          ctx={wall.ctx}
          cfg={cfg}
          isMember={isMember}
          onUpgrade={() => checkout(cfg?.price_pro_yearly ?? null)}
          onBuyCredits={() => checkout(cfg?.price_credit_pack ?? null)}
          onClose={close}
        />
      )}
      {wall.kind === 'space' && (
        <SpaceWall
          cfg={cfg}
          isMember={isMember}
          onUpgrade={() => checkout(cfg?.price_pro_yearly ?? null)}
          onBuySpace={() => checkout(cfg?.price_space_pack ?? null)}
          onClose={close}
        />
      )}
    </Ctx.Provider>
  );
}

// ── 积分墙(§9):纯「量」的墙,不是功能锁。会员撞墙不显示「升级」。 ──────
function CreditWall({
  ctx,
  cfg,
  isMember,
  onUpgrade,
  onBuyCredits,
  onClose,
}: {
  ctx: WallCtx;
  cfg: BillingConfig | null;
  isMember: boolean;
  onUpgrade: () => void;
  onBuyCredits: () => void;
  onClose: () => void;
}) {
  const packAmount = cfg?.credit_pack_amount ?? 300;
  const bigCost = ctx.needed >= (cfg?.cost_unit_generation ?? 10);
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
        <h3>本月积分不够{bigCost ? '生成这一单元' : '问这一次'}</h3>
        <p>
          {isMember
            ? '你的会员积分本月也用完了 —— 加个积分包续上,或等下月刷新。'
            : `这次需 ${ctx.needed} 积分,你还剩 ${ctx.balance}。到期后免费额度会刷新,或现在续上。`}
        </p>
        <span className="pw-keep">✓ 功能没被锁 —— 阅读、已生成内容照常用</span>
      </div>
      <div className="pw-opts">
        {!isMember && (
          <button className="pw-opt hero" onClick={onUpgrade}>
            <div className="pw-oic">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round">
                <path d="M5 16l2-9 5 5 5-7 2 11z" />
              </svg>
            </div>
            <div className="pw-otx">
              <div className="t">
                升级会员 <span className="pw-badge">最划算</span>
              </div>
              <div className="d">
                每月 {cfg?.member_monthly_credits ?? 800} 积分 · 空间上限 {cfg?.member_space_cap ?? 50} · 功能全开
              </div>
            </div>
            <div className="pw-price">
              {DISPLAY_PRICES.proYearly}
              <small>/年</small>
            </div>
          </button>
        )}
        <button className="pw-opt" onClick={onBuyCredits}>
          <div className="pw-oic">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v8M9 11h6" />
            </svg>
          </div>
          <div className="pw-otx">
            <div className="t">买积分包</div>
            <div className="d">+{packAmount} 积分 · 一次性 · 不随月度重置</div>
          </div>
          <div className="pw-price">
            {DISPLAY_PRICES.creditPack}
            <small>一次性</small>
          </div>
        </button>
      </div>
      <div className="pw-foot">
        <button onClick={onClose}>暂不,等下次刷新</button>
      </div>
    </Scrim>
  );
}

// ── 空间墙(§9):三条出口 —— 会员 / 空间包 / 邀请解锁。 ────────────────
function SpaceWall({
  cfg,
  isMember,
  onUpgrade,
  onBuySpace,
  onClose,
}: {
  cfg: BillingConfig | null;
  isMember: boolean;
  onUpgrade: () => void;
  onBuySpace: () => void;
  onClose: () => void;
}) {
  return (
    <Scrim onClose={onClose}>
      <div className="pw-cap">
        <div className="pw-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--amber-deep)" strokeWidth="2" strokeLinejoin="round">
            <rect x="3" y="4" width="7" height="7" rx="1.5" />
            <rect x="14" y="4" width="7" height="7" rx="1.5" />
            <path d="M7 14v6M4 17h6" />
          </svg>
        </div>
        <h3>已用满当前学习空间</h3>
        <p>想再开一个新方向,下面几种方式都行。</p>
        <span className="pw-keep">✓ 现有空间和全部功能不受影响</span>
      </div>
      <div className="pw-opts">
        {!isMember && (
          <button className="pw-opt hero" onClick={onUpgrade}>
            <div className="pw-oic">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round">
                <path d="M5 16l2-9 5 5 5-7 2 11z" />
              </svg>
            </div>
            <div className="pw-otx">
              <div className="t">
                升级会员 <span className="pw-badge">最划算</span>
              </div>
              <div className="d">空间上限升到 {cfg?.member_space_cap ?? 50} · 每月 {cfg?.member_monthly_credits ?? 800} 积分</div>
            </div>
            <div className="pw-price">
              {DISPLAY_PRICES.proYearly}
              <small>/年</small>
            </div>
          </button>
        )}
        <button className="pw-opt" onClick={onBuySpace}>
          <div className="pw-oic">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2.2" strokeLinecap="round">
              <rect x="4" y="5" width="6" height="6" rx="1.5" />
              <rect x="14" y="5" width="6" height="6" rx="1.5" />
              <path d="M7 15v5M4.5 17.5h5" />
            </svg>
          </div>
          <div className="pw-otx">
            <div className="t">买空间包</div>
            <div className="d">+{cfg?.space_pack_amount ?? 5} 个空间 · 一次性 · 不订阅也能开</div>
          </div>
          <div className="pw-price">
            {DISPLAY_PRICES.spacePack}
            <small>一次性</small>
          </div>
        </button>
        <Link href="/app/invite" className="pw-opt" onClick={onClose}>
          <div className="pw-oic">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2.2" strokeLinecap="round">
              <path d="M16 11a4 4 0 10-8 0M4 20a6 6 0 0116 0M18 7h4M20 5v4" />
            </svg>
          </div>
          <div className="pw-otx">
            <div className="t">邀请好友解锁</div>
            <div className="d">每邀 1 位注册,你和 TA 各 +1 空间</div>
          </div>
          <div className="pw-price" style={{ color: 'var(--sage)', fontSize: 13 }}>
            免费
          </div>
        </Link>
      </div>
      <div className="pw-foot">
        <button onClick={onClose}>先归档一个旧空间</button>
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
