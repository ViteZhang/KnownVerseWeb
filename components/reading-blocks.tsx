'use client';
import type { ContentBlock } from '@/lib/types';
import { blockText } from '@/lib/section-context';

export type Heading = { id: string; text: string };

/** 抽取单元内 h2 标题做右栏目录锚点（id 与渲染一致：sec-<index>）。 */
export function headingsOf(blocks: ContentBlock[]): Heading[] {
  const out: Heading[] = [];
  blocks.forEach((b, i) => {
    if (b.type === 'h2') out.push({ id: `sec-${i}`, text: blockText(b) });
  });
  return out;
}

/** 按块数组渲染正文（样式对照原型 .rd-*）。para/card 带 data-block-index 供划词定位。 */
export function ReadingBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        const text = blockText(b);
        switch (b.type) {
          case 'guide':
            return (
              <div className="rd-guide" key={i}>
                {text}
              </div>
            );
          case 'goals': {
            const items: string[] = Array.isArray((b as any).items)
              ? (b as any).items
              : [];
            return (
              <div className="rd-goals" key={i}>
                <div className="gh">学完本单元你将能够</div>
                <ul>
                  {items.map((it, j) => (
                    <li key={j}>{it}</li>
                  ))}
                </ul>
              </div>
            );
          }
          case 'h2':
            return (
              <div className="rd-h2" id={`sec-${i}`} key={i}>
                {text}
              </div>
            );
          case 'h3':
            return (
              <div className="rd-h3" id={`sec-${i}`} key={i}>
                {text}
              </div>
            );
          case 'para':
            return (
              <p className="para" data-block-index={i} key={i}>
                {text}
              </p>
            );
          case 'card':
            return (
              <div className="rd-card" data-block-index={i} key={i}>
                {text}
              </div>
            );
          default:
            return (
              <div className="rd-card" data-block-index={i} key={i}>
                {text || JSON.stringify(b)}
              </div>
            );
        }
      })}
    </>
  );
}
