import { useCallback, useState } from 'react';

/** A layout preference (is this panel collapsed), not content — kept in localStorage per key so
 * it survives a reload, same as everything else in this app that persists locally. */
export function useCollapse(key: string, defaultValue = false) {
  const storageKey = `chronoscope.collapsed.${key}`;
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw === null ? defaultValue : raw === '1';
    } catch {
      return defaultValue;
    }
  });
  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* session-only */ }
      return next;
    });
  }, [storageKey]);
  return [collapsed, toggle] as const;
}
