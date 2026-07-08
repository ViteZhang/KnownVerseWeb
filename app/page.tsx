// 公开落地页（施工 §3 Plan A：/ = 营销页 · §4 分区）。
// Server Component：所有正文在 HTML 源码里，可被搜索引擎抓取（§5.1）。
// 交互只下沉到两个小客户端边界：Reveal（滚动淡入）与 StartCta（登录态判断）。
import type { Metadata } from 'next';

import { LandingCases } from '@/components/landing/cases';
import { LandingDiff } from '@/components/landing/diff';
import { LandingFinal } from '@/components/landing/final';
import { LandingFooter } from '@/components/landing/footer';
import { LandingHero } from '@/components/landing/hero';
import { LandingHow } from '@/components/landing/how';
import { LandingJsonLd } from '@/components/landing/json-ld';
import { LandingNav } from '@/components/landing/nav';
import { LandingProblems } from '@/components/landing/problems';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function LandingPage() {
  return (
    <div className="landing">
      <LandingJsonLd />
      {/* 无 JS 兜底：不执行 IntersectionObserver 时，直接显示所有 .reveal 内容。 */}
      <noscript>
        {/* eslint-disable-next-line react/no-danger */}
        <style
          dangerouslySetInnerHTML={{
            __html:
              '.landing .reveal{opacity:1 !important;transform:none !important}',
          }}
        />
      </noscript>
      <LandingNav />
      <LandingHero />
      <LandingProblems />
      <LandingHow />
      <LandingDiff />
      <LandingCases />
      <LandingFinal />
      <LandingFooter />
    </div>
  );
}
