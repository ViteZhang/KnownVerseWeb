// 可插拔分析注入点（施工 §5.9）。本轮不硬绑某一家：默认什么都不加载，
// 创始人决定工具后在 .env 填对应变量即启用，密钥全走环境变量。
//   · Plausible / Umami：设 NEXT_PUBLIC_PLAUSIBLE_DOMAIN（可选 NEXT_PUBLIC_PLAUSIBLE_SRC 指向自建脚本）
//   · GA4：设 NEXT_PUBLIC_GA_ID
export function Analytics() {
  const ga = process.env.NEXT_PUBLIC_GA_ID;
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const plausibleSrc =
    process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? 'https://plausible.io/js/script.js';

  if (plausibleDomain) {
    return <script defer data-domain={plausibleDomain} src={plausibleSrc} />;
  }

  if (ga) {
    return (
      <>
        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${ga}`}
        />
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');`,
          }}
        />
      </>
    );
  }

  return null;
}
