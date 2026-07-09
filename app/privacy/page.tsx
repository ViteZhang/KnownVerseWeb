import type { Metadata } from 'next';

import { LegalShell } from '@/components/legal/shell';
import { COMPANY, DATA_REGION, SITE_NAME, SITE_URL, SUPPORT_EMAIL } from '@/lib/site';

export const metadata: Metadata = {
  title: '隐私政策',
  description: `${SITE_NAME}隐私政策:我们收集哪些信息、如何使用、与谁共享、如何保护,以及你的权利。`,
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
};

const UPDATED = '2026-07-09';

// 合规样板。邮箱/存储区域等具体值集中在 lib/site.ts。
export default function PrivacyPage() {
  return (
    <LegalShell eyebrow="Privacy Policy" title="隐私政策" updated={UPDATED}>
      <p>
        {COMPANY}(以下简称「我们」)尊重并保护你的隐私。本隐私政策说明我们在你使用{SITE_NAME}
        (Knowledgeverse)时如何收集、使用、共享与保护你的个人信息。
      </p>

      <h2>1. 我们收集的信息</h2>
      <ul>
        <li>
          <strong>账户信息</strong>:注册时的邮箱、显示名;登录凭据由认证服务安全保管,我们不存储明文密码。
        </li>
        <li>
          <strong>学习数据</strong>:你创建的学习空间、学习路径、单元内容、划词提问与问答记录、阅读进度、你主动填写的「关于我」记忆与阅读偏好、以及你导入的内容。
        </li>
        <li>
          <strong>交易信息</strong>:订阅与加购的状态、积分与空间额度、计费周期。<strong>支付卡等敏感支付信息由 Paddle 处理,我们不接触也不存储你的完整卡号。</strong>
        </li>
        <li>
          <strong>使用与技术信息</strong>:为保障服务与改进体验而产生的必要日志(如设备/浏览器类型、访问时间、用量计量)。
        </li>
      </ul>

      <h2>2. 我们如何使用信息</h2>
      <ul>
        <li>提供、维护并个性化本服务(如按你的档案生成学习内容);</li>
        <li>处理订阅、加购、积分发放与额度计量;</li>
        <li>保障安全、防止滥用与欺诈、进行必要的用量成本监控;</li>
        <li>在你同意的范围内与你沟通(如重要通知、账户与订阅相关信息)。</li>
      </ul>

      <h2>3. AI 处理说明</h2>
      <p>
        为生成个性化学习内容与回答,你的相关输入会传输给我们的第三方大语言模型服务商进行处理。我们仅传输实现该功能所必需的内容,并要求服务商按合同约定处理数据。AI 输出可能不准确,请勿作为专业决策的唯一依据。
      </p>

      <h2>4. 信息的共享</h2>
      <p>我们不出售你的个人信息。仅在以下情形共享:</p>
      <ul>
        <li>
          <strong>支付服务商 Paddle</strong>:为完成结算、开票、税务与退款处理;
        </li>
        <li>
          <strong>基础设施与 AI 服务商</strong>:为提供托管、认证、数据库与模型推理等必要能力;
        </li>
        <li>法律要求或为保护我们及用户合法权益之必需时。</li>
      </ul>

      <h2>5. 数据存储与安全</h2>
      <p>
        我们采取合理的技术与管理措施保护你的信息,包括传输加密与访问控制。你的积分、订阅与额度等敏感字段只能由服务端在校验后写入,客户端无写入权限。数据主要存储于 {DATA_REGION}。
      </p>

      <h2>6. 你的权利</h2>
      <ul>
        <li>访问、更正你的账户与学习资料;</li>
        <li>
          <strong>注销账户并删除数据</strong>:你可在产品内发起账户删除,我们会删除或匿名化与你相关的个人数据(法律要求保留的除外);
        </li>
        <li>撤回同意、限制或反对某些处理(在适用法律范围内)。</li>
      </ul>

      <h2>7. 数据保留</h2>
      <p>
        我们在为你提供服务及履行法律义务所必需的期间内保留你的信息。账户删除后,我们会在合理期限内清除或匿名化相关数据;交易与开票记录可能按法律要求保留一定年限。
      </p>

      <h2>8. 儿童隐私</h2>
      <p>
        本服务不面向低于法定年龄的儿童。若你认为未成年人在未经监护人同意下向我们提供了个人信息,请联系我们删除。
      </p>

      <h2>9. 政策变更</h2>
      <p>我们可能更新本政策。重大变更会通过产品内或邮件通知,并在本页标注最新更新日期。</p>

      <h2>10. 联系我们</h2>
      <p>
        如对本隐私政策或你的个人信息有任何疑问或请求,请联系:
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>。
      </p>
      <p>
        运营主体:{COMPANY}
        <br />
        网站:<a href={SITE_URL}>{SITE_URL}</a>
      </p>
    </LegalShell>
  );
}
