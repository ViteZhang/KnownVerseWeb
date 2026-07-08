import type { Metadata } from 'next';
import { Inter, Noto_Serif_SC } from 'next/font/google';
import './globals.css';
import { Analytics } from '@/components/analytics';
import {
  OG_DESCRIPTION,
  OG_TITLE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from '@/lib/site';

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
  metadataBase: new URL(SITE_URL),
  // 首页用完整定位句；其余公开页用 `%s · 知识宇宙` 模板。
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // canonical 按页设置（首页 / 与每篇博客各指自身），不在根层统一，避免被子页继承成同一个。
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: OG_TITLE,
    description: OG_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: OG_TITLE,
    description: OG_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${notoSerif.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
