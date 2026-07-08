// 博客内容层（施工 §5.8）。内容源 = 本地 Markdown（content/blog/*.md）。
// 只在服务端（构建期 SSG / sitemap）读取文件系统；不引入额外依赖，自带极简 frontmatter 解析。
import fs from 'node:fs';
import path from 'node:path';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  updated: string; // YYYY-MM-DD，缺省回落到 date
};
export type Post = PostMeta & { content: string };

// 极简 frontmatter 解析：--- 之间的 key: value 行 + 其后的正文。够用即可，无需 gray-matter。
function parse(raw: string): { data: Record<string, string>; body: string } {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const val = line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (key) data[key] = val;
  }
  return { data, body: m[2] };
}

function readPost(file: string): Post | null {
  const slug = file.replace(/\.md$/, '');
  const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
  const { data, body } = parse(raw);
  if (!data.title) return null;
  const date = data.date ?? '';
  return {
    slug: data.slug || slug,
    title: data.title,
    description: data.description ?? '',
    date,
    updated: data.updated || date,
    content: body.trim(),
  };
}

/** 全部文章（按日期倒序），构建期读取。目录不存在时安全返回空。 */
export function getAllPosts(): Post[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md'))
    .map(readPost)
    .filter((p): p is Post => p !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostSlugs(): string[] {
  return getAllPosts().map((p) => p.slug);
}

export function getPostBySlug(slug: string): Post | null {
  return getAllPosts().find((p) => p.slug === slug) ?? null;
}
