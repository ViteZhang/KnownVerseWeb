'use client';
import { useState } from 'react';

import {
  resendSignupOtp,
  signIn,
  signUpWithEmail,
  verifySignupOtp,
} from '@/lib/auth';

type Mode = 'login' | 'register' | 'otp';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // 登录成功后整页跳首页：用 location.assign 而非 router.replace，确保浏览器把刚写入的
  // 会话 Cookie 一并发给服务端 middleware，避免「Cookie 还没落地就被打回登录页」的竞态。
  const goHome = () => {
    window.location.assign('/app');
  };

  const onLogin = async () => {
    setErr(null);
    setBusy(true);
    const r = await signIn(email, password);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    goHome();
  };

  const onRegister = async () => {
    setErr(null);
    setOk(null);
    setBusy(true);
    const r = await signUpWithEmail(email, password);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    if (r.needConfirm) {
      setMode('otp');
      setOk('验证码已发送到邮箱，请查收并填入。');
    } else {
      goHome();
    }
  };

  const onVerify = async () => {
    setErr(null);
    setBusy(true);
    const r = await verifySignupOtp(email, otp);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    goHome();
  };

  const onResend = async () => {
    setErr(null);
    setOk(null);
    const r = await resendSignupOtp(email);
    if (!r.ok) return setErr(r.error);
    setOk('验证码已重新发送。');
  };

  const submit = () => {
    if (busy) return;
    if (mode === 'login') onLogin();
    else if (mode === 'register') onRegister();
    else onVerify();
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="big">
          知识<span>宇宙</span>
        </div>
        <div className="tag-line">
          有结构、有进度、可沉淀的
          <br />
          个人学习空间
        </div>
        <svg className="pathline" viewBox="0 0 170 44" fill="none">
          <path
            d="M6 30 C 40 30, 45 12, 78 12 S 130 32, 164 14"
            stroke="var(--amber-line)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeDasharray="3 6"
          />
          <circle cx="6" cy="30" r="4" fill="var(--amber-deep)" />
          <circle cx="78" cy="12" r="4" fill="var(--amber)" />
          <circle cx="164" cy="14" r="4" fill="var(--ink)" />
        </svg>

        {mode === 'otp' ? (
          <>
            <input
              className="field"
              placeholder="6 位验证码"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            {err && <div className="err">{err}</div>}
            {ok && <div className="ok">{ok}</div>}
            <button className="primary" onClick={submit} disabled={busy}>
              {busy ? '验证中…' : '确认并进入'}
            </button>
            <div className="switch">
              没收到？
              <a onClick={onResend}> 重发验证码</a>
              {' · '}
              <a onClick={() => { setMode('login'); setErr(null); setOk(null); }}>
                返回登录
              </a>
            </div>
          </>
        ) : (
          <>
            <input
              className="field"
              placeholder="邮箱地址"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            <input
              className="field"
              placeholder="密码（至少 6 位）"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            {err && <div className="err">{err}</div>}
            {ok && <div className="ok">{ok}</div>}
            <button className="primary" onClick={submit} disabled={busy}>
              {busy
                ? '请稍候…'
                : mode === 'login'
                  ? '登录'
                  : '注册并开始'}
            </button>
            {mode === 'login' ? (
              <>
                <div className="reg-note">没有账号？直接用邮箱注册即可开始</div>
                <div className="switch">
                  <a onClick={() => { setMode('register'); setErr(null); setOk(null); }}>
                    用邮箱注册 →
                  </a>
                </div>
              </>
            ) : (
              <div className="switch">
                已有账号？
                <a onClick={() => { setMode('login'); setErr(null); setOk(null); }}>
                  {' '}
                  去登录
                </a>
              </div>
            )}
          </>
        )}

        <div className="foot">在电脑上继续你手机里的学习 · 自动同步</div>
      </div>
    </div>
  );
}
