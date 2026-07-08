/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 路由迁移（§3 Plan A）：App 页面从 /* 迁到 /app/*。旧深链 301 到新位，避免 404。
  // 注：/ 现在是落地页（语义已变），不重定向；旧的 /（我的空间）现为 /app。
  async redirects() {
    return [
      { source: '/new', destination: '/app/new', permanent: true },
      { source: '/about', destination: '/app/about', permanent: true },
      { source: '/prefs', destination: '/app/prefs', permanent: true },
      { source: '/space/:path*', destination: '/app/space/:path*', permanent: true },
    ];
  },
};

export default nextConfig;
