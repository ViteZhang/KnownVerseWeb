// 鉴权（开放注册 + 邮箱登录 + 6 位 OTP 确认）。移植自 App src/lib/auth.ts。
'use client';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { getSupabase } from '@/lib/supabase/client';

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
}

function friendly(msg: string): string {
  if (/invalid login|credentials/i.test(msg)) return '邮箱或密码不对。';
  if (/email not confirmed/i.test(msg)) return '邮箱尚未确认，请查收确认邮件。';
  return '登录失败，请稍后再试。';
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await getSupabase().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, error: null };
}

// 邮箱注册（开放注册）。handle_new_user 触发器自动给配额 + referral_code。
// needConfirm：项目开了「邮箱确认」时 signUp 不返回 session，需用 6 位验证码确认。
export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<{ ok: boolean; needConfirm: boolean; error: string | null }> {
  const { data, error } = await getSupabase().auth.signUp({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) {
    const msg = error.message ?? '';
    const friendlyMsg = /registered|exists|already/i.test(msg)
      ? '该邮箱已注册，请直接登录。'
      : /password/i.test(msg)
        ? '密码至少 6 位。'
        : '注册失败，请稍后再试。';
    return { ok: false, needConfirm: false, error: friendlyMsg };
  }
  return { ok: true, needConfirm: !data.session, error: null };
}

function friendlyOtp(msg: string): string {
  if (/expired|invalid|token/i.test(msg)) return '验证码不对或已过期，请重试或重发。';
  return '验证失败，请稍后再试。';
}

// 校验注册邮件里的 6 位验证码（OTP）。成功即确认邮箱 + 直接登录。
export async function verifySignupOtp(
  email: string,
  token: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await getSupabase().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'signup',
  });
  if (error) return { ok: false, error: friendlyOtp(error.message) };
  return { ok: true, error: null };
}

export async function resendSignupOtp(
  email: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await getSupabase().auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
  });
  if (error) {
    const msg = error.message ?? '';
    const friendlyMsg = /rate|seconds|too many/i.test(msg)
      ? '发送太频繁，请稍候再试。'
      : '验证码发送失败，请稍后再试。';
    return { ok: false, error: friendlyMsg };
  }
  return { ok: true, error: null };
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}
