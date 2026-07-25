// 站点级常量（施工 §5）。canonical 主机固定无 www；文案取自落地页原型的 <title>/<meta>。
export const SITE_URL = 'https://knowledgeverse.space';
export const SITE_NAME = '知识宇宙';
export const SITE_NAME_EN = 'Knowledgeverse';
// 运营主体:个人开发者,无公司实体。法务页/结构化数据统一用品牌名 + 联系邮箱,弱化个人姓名。
export const COMPANY = '知识宇宙(Knowledgeverse)';

// 首页 title / description —— 与原型 <title> / <meta name="description"> 一致（§5.2）。
export const SITE_TITLE =
  '知识宇宙 · 把用 AI 学习，变成属于你的个人学习空间';
export const SITE_DESCRIPTION =
  '聊天框适合问答，不适合学习。知识宇宙把每一个学习目标变成独立的学习空间——AI 为你生成学习路径、可随手划线提问、问答自动沉淀。面向华语终身学习者。';

// 法务 / 合规常量：集中一处，法务页共用，改一处即全站生效。
// 纯积分制过渡版:无在线支付,充值走线下微信 + 激活码;管辖法律按《用户服务协议 过渡版 v1》定为大陆地区法律。
export const SUPPORT_EMAIL = 'zhangzhao@dreamerlab.cn';
export const GOVERNING_LAW = '中华人民共和国大陆地区法律（不含冲突法规则）';
export const DATA_REGION = '中国大陆境外（Supabase · 新加坡 ap-southeast-1）';
export const REFUND_SLA = '合理时间(手工处理)';
// 生效/更新日期与运营者标识,法务三页共用。
export const LEGAL_UPDATED = '2026-07-25';
export const OPERATOR = '知识宇宙 运营者(个人运营者)';

// OG 用更口语的一句，取自原型 og:title / og:description。
export const OG_TITLE = SITE_TITLE;
export const OG_DESCRIPTION =
  '每一个想学的东西，都是一个有结构、有进度、能沉淀的学习空间。AI 带着对你的了解陪你学。';
