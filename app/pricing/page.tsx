// 定价页已改为「积分说明页」/credits(纯积分制,无在线订阅)。
// 保留 /pricing 路由做 301 永久跳转,不破坏站内旧链接与搜索引擎已收录的 URL。
import { permanentRedirect } from 'next/navigation';

export default function PricingRedirect() {
  permanentRedirect('/credits');
}
