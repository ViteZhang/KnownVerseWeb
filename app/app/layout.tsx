// 产品区布局：给所有 /app/* 页面挂 noindex（§5.3 双保险，robots.txt 已 Disallow /app）。
// 这些页是客户端组件、无法各自 export metadata，故由这层服务端布局统一声明。
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppAreaLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
