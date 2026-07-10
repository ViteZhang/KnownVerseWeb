// Paddle.js overlay checkout(Phase 3 §9)。只用公开的 client-side token;
// 密钥/验签在 Edge Function,前端只负责「打开结账 + 带上 user_id」。
//
// 灵魂链路映射靠 customData.user_id:结账时把当前登录用户的 Supabase id 传进去,
// Paddle 事件里原样回传 data.custom_data.user_id,webhook 据此发积分/解锁空间。

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Paddle?: any;
  }
}

const PADDLE_JS = 'https://cdn.paddle.com/paddle/v2/paddle.js';

let ready: Promise<any> | null = null;

/** 懒加载并初始化 Paddle.js(单例)。缺 token 时 reject,由调用方兜底。 */
export function loadPaddle(): Promise<any> {
  if (ready) return ready;
  ready = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('paddle: no window'));
      return;
    }
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) {
      reject(new Error('paddle: missing NEXT_PUBLIC_PADDLE_CLIENT_TOKEN'));
      return;
    }
    const env = process.env.NEXT_PUBLIC_PADDLE_ENV; // 'sandbox' | 'production'(缺省 production)

    const init = () => {
      try {
        if (env === 'sandbox') window.Paddle.Environment.set('sandbox');
        window.Paddle.Initialize({ token });
        resolve(window.Paddle);
      } catch (e) {
        reject(e);
      }
    };

    if (window.Paddle) {
      init();
      return;
    }
    const s = document.createElement('script');
    s.src = PADDLE_JS;
    s.async = true;
    s.onload = init;
    s.onerror = () => reject(new Error('paddle: paddle.js 加载失败'));
    document.head.appendChild(s);
  });
  return ready;
}

// 价格本地化预览(Paddle 域名审核要求「页面价格 = 结账价格」)。
// 用 Paddle.PricePreview 拉当前买家所在地区的真实价格,页面直接展示它,和结账一模一样。
// 按 priceId 排序缓存,全页只发一次请求;失败返回空表,调用方回退到静态展示价。
const previewCache: Record<string, Promise<Record<string, string>>> = {};

export function previewPrices(priceIds: string[]): Promise<Record<string, string>> {
  const ids = priceIds.filter(Boolean);
  const key = [...ids].sort().join(',');
  if (!key) return Promise.resolve({});
  if (!previewCache[key]) {
    previewCache[key] = (async () => {
      try {
        const Paddle = await loadPaddle();
        const res = await Paddle.PricePreview({
          items: ids.map((id) => ({ priceId: id, quantity: 1 })),
        });
        const map: Record<string, string> = {};
        for (const li of res?.data?.details?.lineItems ?? []) {
          const id = li?.price?.id;
          // 用 total(买家实付的全额,含地区税处理)—— 与 Paddle 结账页显示一致,
          // 也是 Paddle 本地化定价文档推荐的展示字段。页面另有税费提示。
          const formatted = li?.formattedTotals?.total ?? li?.formattedTotals?.subtotal;
          if (id && formatted) map[id] = formatted;
        }
        return map;
      } catch {
        return {};
      }
    })();
  }
  return previewCache[key];
}

/** 打开 Pro 订阅 / 加购的 overlay 结账。priceId 由 billing_config 提供;user_id 用于灵魂链路回填。 */
export async function openCheckout(opts: {
  priceId: string;
  userId: string;
  email?: string;
}): Promise<void> {
  const Paddle = await loadPaddle();
  Paddle.Checkout.open({
    items: [{ priceId: opts.priceId, quantity: 1 }],
    customData: { user_id: opts.userId },
    ...(opts.email ? { customer: { email: opts.email } } : {}),
    settings: { displayMode: 'overlay', theme: 'light', locale: 'zh' },
  });
}
