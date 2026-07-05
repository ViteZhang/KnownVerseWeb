// 浏览器端 Supabase 客户端（@supabase/ssr）。
// 只用 anon/publishable key，靠 RLS 保护数据；service-role 绝不出现在客户端。
// 与 App 共用同一个 Supabase 项目，数据天然同源。
import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = url.length > 0 && anonKey.length > 0;

let cached: ReturnType<typeof createBrowserClient> | null = null;

/** 单例浏览器客户端（invoke 会自动带当前会话 JWT 调 Edge Function）。 */
export function getSupabase() {
  if (!cached) cached = createBrowserClient(url, anonKey);
  return cached;
}
