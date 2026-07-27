// 运营后台布局:只做一件事 —— 给 /admin 挂 noindex。
// 内部工具永远不该进搜索索引;页面本身是客户端组件、无法自己 export metadata,故由这层声明。
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '运营后台',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
