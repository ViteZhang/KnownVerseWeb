// 路由分区（施工 §3 · Plan A）：
//   公开区 —— 落地页 `/`、博客 `/blog/*`、SEO 文件等，任何人可访问、可被索引，不做鉴权。
//   产品区 —— `/app/*`，登录后才可进；未登录一律打回 /login。
// 为不给公开静态页平添一次认证往返（影响首屏/SEO），只有 /app/* 与 /login 才走 Supabase 会话逻辑。
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isApp = path === '/app' || path.startsWith('/app/');
  const isLogin = path === '/login';

  // 公开页直接放行——不触发会话刷新，落地页/博客保持纯静态、零认证延迟。
  if (!isApp && !isLogin) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 未登录进产品区 → 去登录页。
  if (!user && isApp) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return NextResponse.redirect(redirectUrl);
  }
  // 已登录还停在登录页 → 直达产品首页。
  if (user && isLogin) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/app';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  // 跳过静态资源与 SEO 文件；页面级鉴权在函数体内按路由再细分。
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
