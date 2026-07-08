// robots（施工 §5.3）：允许抓公开页，屏蔽产品区 /app 与 /login，指向 sitemap。
import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/app', '/login'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
