// sitemap（施工 §5.3）：首页 + 博客列表 + 每篇博客，URL 均为带域名绝对路径。
// 博客部分从内容源动态生成 —— 新增一篇 .md 即自动出现在 sitemap。
import type { MetadataRoute } from 'next';

import { getAllPosts } from '@/lib/blog';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const now = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: posts[0] ? new Date(posts[0].updated) : now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...posts.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: new Date(p.updated),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
