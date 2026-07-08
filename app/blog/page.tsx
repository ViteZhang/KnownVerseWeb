// 博客列表页（SSG，Server Component）。
import type { Metadata } from 'next';
import Link from 'next/link';

import { BlogShell } from '@/components/blog/shell';
import { getAllPosts } from '@/lib/blog';

export const metadata: Metadata = {
  title: '博客',
  description: '关于 AI 学习、个人学习空间与学习方法的思考与记录。',
  alternates: { canonical: '/blog' },
};

function fmtDate(d: string): string {
  return d.replace(/-/g, '.');
}

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <BlogShell>
      <header className="blog-head">
        <div className="sec-eyebrow">博客</div>
        <h1>写给认真学习的人</h1>
        <p>关于 AI 学习、个人学习空间与学习方法的思考与记录。</p>
      </header>

      {posts.length === 0 ? (
        <p className="blog-empty">还没有文章，敬请期待。</p>
      ) : (
        <ul className="blog-list">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link className="post-card" href={`/blog/${p.slug}`}>
                <time className="post-date" dateTime={p.date}>
                  {fmtDate(p.date)}
                </time>
                <h2>{p.title}</h2>
                <p>{p.description}</p>
                <span className="post-more">阅读全文 →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BlogShell>
  );
}
