// 划词上下文与块工具。移植自 App src/app/unit.tsx:69-111。
import type { ContentBlock } from '@/lib/types';

// 仅 para / card 块可划词问 AI（标题/导语属结构元素）。
export function isSelectable(type: string): boolean {
  return type === 'para' || type === 'card';
}

// 安全取块文本（goals 块没有 text，用 items；其余用 text）。
export function blockText(b: ContentBlock): string {
  if (typeof (b as any).text === 'string') return (b as any).text;
  if (Array.isArray((b as any).items)) return (b as any).items.join('\n');
  return '';
}

// 拼「所在小节」上下文（施工 §3 入参 sectionContext）：
// 从选中块往上找最近标题作节首、往下找下一个标题作节尾，拼节内文本并截断。
const SECTION_MAX = 1200;
export function buildSectionContext(blocks: ContentBlock[], index: number): string {
  const isHeading = (t: string) => t === 'h2' || t === 'h3';
  let start = 0;
  for (let i = index; i >= 0; i--) {
    if (isHeading(blocks[i].type)) {
      start = i;
      break;
    }
  }
  let end = blocks.length;
  for (let i = index + 1; i < blocks.length; i++) {
    if (isHeading(blocks[i].type)) {
      end = i;
      break;
    }
  }
  const text = blocks
    .slice(start, end)
    .map((b) => blockText(b))
    .filter(Boolean)
    .join('\n');
  return text.slice(0, SECTION_MAX);
}
