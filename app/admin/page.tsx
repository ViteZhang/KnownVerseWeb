'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { useSession } from '@/lib/auth';
import { fetchDashboardStats, FORBIDDEN, type DashboardStats } from '@/lib/admin';

import s from './admin.module.css';
import { CodesTab } from './codes-tab';
import { DashboardTab } from './dashboard-tab';
import { GenerateTab } from './generate-tab';
import { useToast } from './toast';

type Tab = 'dash' | 'gen' | 'mng';
type Gate = 'checking' | 'anon' | 'denied' | 'error' | 'ok';

// 运营后台(《施工提示词_运营后台_看板与激活码管理_Web版》§5)。
//
// 守卫:真正的门禁在服务端 —— 每个 admin_* RPC 第一行都校验 is_admin,非管理员一律 FORBIDDEN、
// 不吐任何数据。这里的守卫只是体验层:用 admin_dashboard_stats 探一次权限,非管理员直接渲染
// 「无权限」,不渲染任何后台内容。普通用户界面里也不出现任何 /admin 入口链接。
export default function AdminPage() {
  const { session, loading } = useSession();
  const [gate, setGate] = useState<Gate>('checking');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tab, setTab] = useState<Tab>('dash');
  // 生成激活码后要刷新「激活码管理」的列表与汇总。两个 tab 是兄弟组件,
  // 用一个自增版本号当信号,比把列表状态提到这一层更省事。
  const [codesVersion, setCodesVersion] = useState(0);
  const { toast, toastNode } = useToast();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      setGate('anon');
      return;
    }
    let alive = true;
    fetchDashboardStats().then((r) => {
      if (!alive) return;
      if (r.ok) {
        setStats(r.data);
        setGate('ok');
      } else {
        setGate(r.error === FORBIDDEN ? 'denied' : 'error');
      }
    });
    return () => {
      alive = false;
    };
  }, [session, loading]);

  const onGenerated = useCallback(() => setCodesVersion((v) => v + 1), []);

  if (loading || gate === 'checking') {
    return (
      <div className={s.wrap}>
        <div className={s.loading}>正在核对权限…</div>
      </div>
    );
  }

  if (gate !== 'ok') {
    const copy = {
      anon: { h: '请先登录', p: '这是内部运营工具,登录后才能进。', href: '/login', a: '去登录 →' },
      denied: {
        h: '无权限',
        p: '这个页面只对运营管理员开放。若你认为这是误判,请联系创始人。',
        href: '/app',
        a: '回到我的空间 →',
      },
      error: {
        h: '读取失败',
        p: '没能连上服务器,请检查网络后刷新重试。',
        href: '/app',
        a: '回到我的空间 →',
      },
    }[gate];
    return (
      <div className={s.wrap}>
        <div className={s.gate}>
          <h1>{copy.h}</h1>
          <p>{copy.p}</p>
          <p style={{ marginTop: 16 }}>
            <Link href={copy.href}>{copy.a}</Link>
          </p>
        </div>
      </div>
    );
  }

  const email = session?.user.email ?? '';

  return (
    <div className={s.wrap}>
      <div className={s.win}>
        <div className={s.topbar}>
          <div className={s.brand}>
            知识<span>宇宙</span>
          </div>
          <span className={s.crumb}>运营后台</span>
          <span className={s.pillAdmin}>仅管理员</span>
          <div className={s.spacer} />
          <span className={`${s.crumb} ${s.hideSm}`}>{email}</span>
          <div className={s.avatar}>{email ? email[0].toUpperCase() : '·'}</div>
        </div>

        <div className={s.nav}>
          <button className={tab === 'dash' ? s.on : ''} onClick={() => setTab('dash')}>
            用量看板
          </button>
          <button className={tab === 'gen' ? s.on : ''} onClick={() => setTab('gen')}>
            生成激活码
          </button>
          <button className={tab === 'mng' ? s.on : ''} onClick={() => setTab('mng')}>
            激活码管理
          </button>
        </div>

        {/* 三个 tab 常驻挂载:切走再切回不重新拉数据,刚生成的码也不会因切 tab 丢失。 */}
        <div className={s.pane} hidden={tab !== 'dash'}>
          <DashboardTab stats={stats} />
        </div>
        <div className={s.pane} hidden={tab !== 'gen'}>
          <GenerateTab toast={toast} onGenerated={onGenerated} />
        </div>
        <div className={s.pane} hidden={tab !== 'mng'}>
          <CodesTab toast={toast} refreshKey={codesVersion} />
        </div>
      </div>
      {toastNode}
    </div>
  );
}
