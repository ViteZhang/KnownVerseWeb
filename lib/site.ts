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

// 法务 / 合规常量（Phase 3）：集中一处，法务页与结算说明共用，改一处即全站生效。
export const SUPPORT_EMAIL = 'zhangzhao@dreamerlab.cn';
export const GOVERNING_LAW = '新加坡共和国法律'; // 管辖条款引用法律体系，非宪法
export const DATA_REGION = '新加坡（Singapore · ap-southeast-1）';
export const REFUND_SLA = '5 个工作日';

// OG 用更口语的一句，取自原型 og:title / og:description。
export const OG_TITLE = SITE_TITLE;
export const OG_DESCRIPTION =
  '每一个想学的东西，都是一个有结构、有进度、能沉淀的学习空间。AI 带着对你的了解陪你学。';
