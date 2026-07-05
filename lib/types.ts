// 共享类型（与 App src/lib/units.ts / spaces.ts 同源）。

/** 单元内容的一个「块」。已知类型给强类型，未知类型兜底渲染。 */
export type ContentBlock =
  | { type: 'guide'; text: string }
  | { type: 'goals'; items: string[] }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'para'; text: string }
  | { type: 'card'; text: string }
  | { type: string; text?: string; items?: string[]; [key: string]: unknown };

export type Unit = {
  id: string;
  space_id: string;
  phase_id: string | null;
  idx: number | null;
  title: string | null;
  status: 'not_generated' | 'learning' | 'done' | string | null;
  content: ContentBlock[] | null;
  generated_at: string | null;
};

export type PathUnit = {
  id: string;
  idx: number;
  title: string;
  status: string;
  source: string;
};

export type PhaseWithUnits = {
  id: string;
  idx: number;
  title: string;
  status: string;
  units: PathUnit[];
};

export type ComputedPhase = PhaseWithUnits & {
  computed: 'done' | 'active' | 'locked';
};

export type SpacePath = {
  space: { id: string; name: string; learning_type: string } | null;
  phases: PhaseWithUnits[];
  error: string | null;
};

export type SpaceCard = {
  id: string;
  name: string;
  learningType: string;
  total: number;
  done: number;
  nextUnitTitle: string | null;
  nextUnitId: string | null;
  finished: boolean;
};

export type QuestionRecord = {
  id: string;
  selected_text: string;
  question: string;
  answer: string;
  created_at: string;
  unit_id: string;
  unit_title: string | null;
};
