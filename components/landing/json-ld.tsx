// 结构化数据（施工 §5.4）：Organization + SoftwareApplication。
// 服务端注入 <script type="application/ld+json">，非客户端。
import { COMPANY, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';

export function LandingJsonLd() {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        legalName: COMPANY,
        url: SITE_URL,
        logo: `${SITE_URL}/opengraph-image`,
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#app`,
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Web, iOS, Android',
        description: SITE_DESCRIPTION,
        publisher: { '@id': `${SITE_URL}/#organization` },
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'CNY',
        },
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
