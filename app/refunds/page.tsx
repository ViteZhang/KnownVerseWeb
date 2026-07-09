import type { Metadata } from 'next';

import { LegalShell } from '@/components/legal/shell';
import { COMPANY, REFUND_SLA, SITE_NAME, SITE_URL, SUPPORT_EMAIL } from '@/lib/site';

export const metadata: Metadata = {
  title: '退款政策',
  description: `${SITE_NAME}退款政策:订阅首期 14 天无理由退款;加购包一经使用不予退款。如何申请与例外情形。`,
  alternates: { canonical: '/refunds' },
  robots: { index: true, follow: true },
};

const UPDATED = '2026-07-09';

// 口径:14 天无理由退款(创始人确认)。邮箱/时限集中在 lib/site.ts。
export default function RefundsPage() {
  return (
    <LegalShell eyebrow="Refund Policy" title="退款政策" updated={UPDATED}>
      <p>
        我们希望你用得安心。以下是{SITE_NAME}(Knowledgeverse)的退款政策。本服务的支付由
        {' '}
        <strong>Paddle</strong> 作为登记商户(Merchant of Record)代为处理,退款亦经 Paddle 原路退回。
      </p>

      <div className="note">
        <strong>一句话版本:</strong>Pro 订阅首期自购买起 <strong>14 天内无理由退款</strong>;一次性加购的积分包 / 空间包,<strong>一经使用不予退款</strong>。
      </div>

      <h2>1. 订阅(Pro 会员)</h2>
      <ul>
        <li>
          <strong>14 天无理由退款</strong>:自你首次订阅付款之日起 14 天内,无需理由即可申请全额退款。
        </li>
        <li>
          <strong>续费周期</strong>:自动续费产生的后续周期费用,若你在扣费后 14 天内且<strong>该周期内基本未使用</strong>会员额度(未消耗新周期发放的会员积分、未依赖会员空间上限新建空间),可申请退款;是否符合条件由我们结合使用记录合理判断。为避免被自动续费,你可随时在到期前一键取消。
        </li>
        <li>退款后,会员权益立即终止,积分与空间额度回落至免费档。</li>
      </ul>

      <h2>2. 一次性加购(积分包 / 空间包)</h2>
      <ul>
        <li>
          <strong>积分包</strong>:购买后若<strong>尚未消耗其中任何积分</strong>,可在 14 天内申请退款;一旦已消耗,则视为已使用,不予退款。
        </li>
        <li>
          <strong>空间包</strong>:购买后若<strong>尚未用其新增名额创建空间</strong>,可在 14 天内申请退款;已使用则不予退款。
        </li>
      </ul>

      <h2>3. 如何申请退款</h2>
      <p>两种方式任选其一:</p>
      <ul>
        <li>
          在你收到的 Paddle 付款邮件中,通过其中的链接直接向 Paddle 发起退款/联系;或
        </li>
        <li>
          发送邮件至 <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>,附上你的<strong>付款邮箱</strong>与<strong>订单号</strong>(可在 Paddle 收据中找到),我们会在 {REFUND_SLA}内处理。
        </li>
      </ul>
      <p>退款将原路退回你的原支付方式;到账时间取决于你的支付渠道与发卡行。</p>

      <h2>4. 例外情形</h2>
      <ul>
        <li>因违反《服务条款》而被终止账户的,已产生的费用一般不予退还;</li>
        <li>滥用退款政策(如反复购买—使用—退款)的申请我们有权拒绝;</li>
        <li>法律另有强制规定的,以适用法律为准(你的法定退款权利不受本政策减损)。</li>
      </ul>

      <h2>5. 联系</h2>
      <p>
        运营主体:{COMPANY}
        <br />
        网站:<a href={SITE_URL}>{SITE_URL}</a>
        <br />
        退款与账单问题:<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalShell>
  );
}
