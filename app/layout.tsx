import type { Metadata } from 'next';
import { Inter, Noto_Serif_SC } from 'next/font/google';
import './globals.css';

// 阅读正文用衬线（Noto Serif SC），UI 用 Inter —— 与 App / 原型同源。
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});
const notoSerif = Noto_Serif_SC({
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-serif',
  display: 'swap',
  // Noto Serif SC 仅 latin 子集可预载；中文按需加载，关闭 preload 避免构建报错。
  preload: false,
});

export const metadata: Metadata = {
  title: '知识宇宙',
  description: '有结构、有进度、可沉淀的个人学习空间',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${notoSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
