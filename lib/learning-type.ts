// learning_type → 标签样式与中文名（对照原型 .tag.career/.skill/.read）。
export function typeTag(t: string): { cls: string; label: string } {
  switch (t) {
    case 'knowledge_career':
      return { cls: 'career', label: '知识职业' };
    case 'skill_practice':
      return { cls: 'skill', label: '技能练习' };
    case 'reading_reflection':
      return { cls: 'read', label: '思辨阅读' };
    case 'exam':
      return { cls: 'career', label: '应试' };
    default:
      return { cls: 'career', label: '学习空间' };
  }
}
