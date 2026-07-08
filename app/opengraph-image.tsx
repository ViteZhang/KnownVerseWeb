// 首页 OG 分享图（施工 §5.5），next/og 代码生成，1200×630，纸感底 + 品牌 + 定位句。
// 同一文件也自动用作 twitter:image。创始人后续可换正式设计图。
import { ImageResponse } from 'next/og';

import { loadSerifSubset } from '@/lib/og-font';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export const runtime = 'nodejs';
export const alt = '知识宇宙 · 把用 AI 学习，变成属于你的个人学习空间';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PAPER = 'linear-gradient(180deg, #FAF8F3 0%, #F1EBDF 100%)';

export default async function OpengraphImage() {
  const host = SITE_URL.replace(/^https?:\/\//, '');
  const brand = SITE_NAME; // 知识宇宙
  const line1 = '把“用 AI 学习”';
  const line2 = '变成一个属于你的个人学习空间';

  const fonts = await loadSerifSubset(brand + line1 + line2 + host);

  // 拿不到中文字体（如无网构建）→ 渲染「无文字」的纸感卡片，Satori 不需要字体，构建必过。
  if (fonts.length === 0) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: PAPER,
          }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 120,
              background: '#20242E',
              border: '6px solid #DD9527',
            }}
          />
        </div>
      ),
      { ...size },
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '90px',
          background: PAPER,
          fontFamily: 'NotoSerifSC',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 84,
            left: 90,
            display: 'flex',
            alignItems: 'center',
            fontSize: 30,
            fontWeight: 700,
            color: '#20242E',
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 14,
              background: '#DD9527',
              marginRight: 14,
            }}
          />
          {brand}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontWeight: 700,
            color: '#20242E',
            fontSize: 68,
            lineHeight: 1.25,
          }}
        >
          <div style={{ display: 'flex' }}>{line1}</div>
          <div style={{ display: 'flex' }}>{line2}</div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 84,
            left: 90,
            display: 'flex',
            fontSize: 26,
            color: '#565B66',
          }}
        >
          {host}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fonts.map((data) => ({
        name: 'NotoSerifSC',
        data,
        style: 'normal' as const,
        weight: 700 as const,
      })),
    },
  );
}
