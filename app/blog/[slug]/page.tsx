// 博客单篇模板（SSG）。唯一 h1、正确标题层级、Article JSON-LD、generateMetadata、自动进 sitemap。
// 正文用 react-markdown 在服务端渲染 —— 文字进 HTML 源码，满足 §5.1。
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { BlogShell } from '@/components/blog/shell';
import { getAllPosts, getPostBySlug } from '@/lib/blog';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const post = getPostBySlug(params.slug);
  if (!post) return {};
  const url = `/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      url,
      publishedTime: post.date,
      modifiedTime: post.updated,
    },
  };
}

function fmtDate(d: string): string {
  return d.replace(/-/g, '.');
}

export default function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = getPostBySlug(params.slug);
  if (!post) notFound();

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated,
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };

  return (
    <BlogShell>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <article className="post">
        <Link className="post-back" href="/blog">
          ← 博客
        </Link>
        <header className="post-header">
          <time className="post-date" dateTime={post.date}>
            {fmtDate(post.date)}
          </time>
          <h1>{post.title}</h1>
          <p className="post-lead">{post.description}</p>
        </header>
        <div className="post-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {post.content}
          </ReactMarkdown>
        </div>
      </article>
    </BlogShell>
  );
}
