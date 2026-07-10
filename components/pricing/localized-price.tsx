'use client';
import { useEffect, useState } from 'react';

import { previewPrices } from '@/lib/paddle';

// 展示某个 priceId 的「买家所在地真实价格」(Paddle Price Preview),和结账页一致。
// allIds:整页要预览的全部 price id(用于一次性批量拉取);fallback:JS/预览不可用时的静态展示价。
export function LocalizedPrice({
  priceId,
  allIds,
  fallback,
}: {
  priceId: string | null;
  allIds: (string | null)[];
  fallback: string;
}) {
  const [text, setText] = useState(fallback);

  useEffect(() => {
    if (!priceId) return;
    let alive = true;
    previewPrices(allIds.filter((x): x is string => !!x)).then((map) => {
      if (alive && map[priceId]) setText(map[priceId]);
    });
    return () => {
      alive = false;
    };
    // allIds 内容固定(来自 billing_config),用 join 做稳定依赖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceId, allIds.join(',')]);

  return <>{text}</>;
}
