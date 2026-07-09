// Paddle 客户中心(customer portal)会话生成(Phase 3 §9)。
// 服务端用 PADDLE_API_KEY(私密,只在 Vercel server env,绝不进前端 bundle)为当前用户的
// paddle_customer_id 生成一个 portal 会话链接,前端拿到后跳转,让用户自助退订/换卡/看发票。
import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    // 尚未配置 API key(创始人重置后填 Vercel env)→ 前端提示「暂未开放」。
    return NextResponse.json({ error: 'portal_unconfigured' }, { status: 503 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // 读本人订阅行拿 customer_id(RLS 只允许读自己)。
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('paddle_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();
  const customerId = sub?.paddle_customer_id;
  if (!customerId) return NextResponse.json({ error: 'no_customer' }, { status: 404 });

  const base =
    process.env.PADDLE_ENV === 'sandbox'
      ? 'https://sandbox-api.paddle.com'
      : 'https://api.paddle.com';
  try {
    const resp = await fetch(`${base}/customers/${customerId}/portal-sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (!resp.ok) {
      return NextResponse.json({ error: 'paddle_error' }, { status: 502 });
    }
    const body = await resp.json();
    const url = body?.data?.urls?.general?.overview;
    if (!url) return NextResponse.json({ error: 'no_url' }, { status: 502 });
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 502 });
  }
}
