'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

import s from './admin.module.css';

/** 后台的轻提示(复制成功 / 作废结果 / 生成失败)。原型底部居中的胶囊。 */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((text: string) => {
    setMsg(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 1800);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const node = (
    <div className={`${s.toast}${msg ? ` ${s.on}` : ''}`} role="status" aria-live="polite">
      {msg}
    </div>
  );

  return { toast, toastNode: node };
}
