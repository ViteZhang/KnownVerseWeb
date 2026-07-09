// 定价页结构化数据(《Phase3》§10):Product + Offer(免费档 + Pro 年/月)。
import type { BillingConfig } from '@/lib/billing';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export function PricingJsonLd({ cfg: _cfg }: { cfg: BillingConfig }) {
  const graph = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${SITE_NAME} Pro`,
    description: '功能从不上锁,会员给你更多学习空间和更多积分。划词问 AI、个性化生成、导入建课对所有用户全开。',
    brand: { '@type': 'Brand', name: SITE_NAME },
    url: `${SITE_URL}/pricing`,
    offers: [
      {
        '@type': 'Offer',
        name: '免费',
        price: '0',
        priceCurrency: 'USD',
        url: `${SITE_URL}/pricing`,
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Pro 会员 · 年付',
        price: '69.99',
        priceCurrency: 'USD',
        url: `${SITE_URL}/pricing`,
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Pro 会员 · 月付',
        price: '8.99',
        priceCurrency: 'USD',
        url: `${SITE_URL}/pricing`,
        availability: 'https://schema.org/InStock',
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
