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
