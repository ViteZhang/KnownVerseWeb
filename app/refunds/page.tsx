import type { Metadata } from 'next';

import { LegalShell } from '@/components/legal/shell';
import { LEGAL_UPDATED, OPERATOR, SITE_NAME, SITE_URL, SUPPORT_EMAIL } from '@/lib/site';

export const metadata: Metadata = {
  title: '退款政策',
  description: `${SITE_NAME}退款政策(过渡版):未消耗的充值积分可按实付比例申请退款;已消耗积分不退;免费所得积分不涉及退款。充值走线下微信 + 激活码。`,
  alternates: { canonical: '/refunds' },
  robots: { index: true, follow: true },
};

// 纯积分制过渡版退款政策(《用户服务协议_过渡版v1》§六)。无在线支付;退款经原转账渠道手工处理。
export default function RefundsPage() {
  return (
    <LegalShell eyebrow="Refund Policy" title="退款政策(过渡版)" updated={LEGAL_UPDATED}>
      <div className="note">
        <strong>一句话版本:</strong>只有<strong>充值(激活码)所得</strong>的积分涉及退款——<strong>未消耗</strong>的部分可按实付比例申请退款,<strong>已消耗</strong>的不退;注册赠送 / 签到 / 邀请等<strong>免费所得积分不涉及退款</strong>。本服务无在线支付,退款经原转账渠道手工处理。
      </div>

      <h2>1. 可退与不可退</h2>
      <p>本服务为虚拟商品 / 服务。就<strong>充值所得积分</strong>,退款规则如下:</p>
      <ul>
        <li>
          <strong>未消耗的充值积分</strong>:可申请退款。退款金额按你就该笔充值<strong>实际支付的金额</strong>、结合<strong>未消耗积分的比例</strong>计算。
        </li>
        <li>
          <strong>已消耗的积分</strong>:<strong>不予退款</strong>(该部分对应的服务已经提供、成本已实际发生)。
        </li>
        <li>
          <strong>免费所得积分</strong>(注册赠送、签到、邀请):因非你付费取得,<strong>不涉及退款</strong>。
        </li>
      </ul>

      <h2>2. 激活码</h2>
      <ul>
        <li><strong>激活码一经兑换即视为充值完成</strong>,之后按第 1 条处理;</li>
        <li><strong>未兑换的激活码</strong>如需退款,请联系运营者核实后处理。</li>
      </ul>

      <h2>3. 如何申请退款</h2>
      <p>
        通过运营者公示的联系方式(邮箱或微信)提出申请,并提供<strong>充值凭证</strong>(转账记录)与你的账号邮箱。退款经运营者核实后,通过<strong>原转账渠道或双方约定方式</strong>退回。由于系个人手工处理,<strong>可能需要合理时间</strong>。
      </p>
      <ul>
        <li>邮箱:<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></li>
        <li>微信:见 <a href="/credits">《积分说明》</a> 页公示的二维码</li>
      </ul>

      <h2>4. 例外情形</h2>
      <ul>
        <li>因你违反 <a href="/terms">《用户服务协议》</a> 被中止服务或清除积分的,<strong>已充值积分不予退款</strong>;</li>
        <li>滥用退款政策(如反复充值—消耗—退款)的申请,运营者有权拒绝;</li>
        <li>若本服务<strong>永久终止</strong>,运营者将就你<strong>未消耗的充值积分</strong>提供合理的退款或其他补偿安排;</li>
        <li>本政策不排除你依法享有的消费者权利;若与所适用的强制性法律规定冲突,以该法律规定为准。</li>
      </ul>

      <h2>5. 联系</h2>
      <p>
        运营者:{OPERATOR}
        <br />
        网站:<a href={SITE_URL}>{SITE_URL}</a>
        <br />
        退款与账号问题:<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalShell>
  );
}
