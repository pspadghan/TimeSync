import { useCallback, useState } from 'react';

/** An automatic log of where you've been, distinct from an explicit "save moment" — same
 * local-only model as everything else (no server, no account needed). Restoring an entry is
 * just navigating back to its URL, so it only ever offers to restore what the URL itself can
 * actually encode (a date, a selected event/person/place, a comparison mode) — not finer state
 * like an exact camera bearing or a divider position, since nothing in the app persists those
 * to the URL today. Honest about what it can bring back, rather than promising more. */
export interface RecentEntry {
  id: string;
  url: string;
  kind: 'map' | 'person' | 'living-history' | 'comparison';
  title: string;
  sub: string;
  at: number;
}

const KEY = 'chronoscope.recent';
const LIMIT = 20;

function read(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

function write(next: RecentEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, LIMIT)));
  } catch {
    // storage unavailable: activity just doesn't persist across reloads this session
  }
}

/** Call when the user lands somewhere worth being able to get back to. De-dupes by id (a
 * second visit to the same place just moves it to the top with a fresh timestamp). */
export function logActivity(entry: Omit<RecentEntry, 'at'>) {
  const next = [{ ...entry, at: Date.now() }, ...read().filter((x) => x.id !== entry.id)];
  write(next);
}

export function useRecent() {
  const [items, setItems] = useState<RecentEntry[]>(read);
  const clear = useCallback(() => { write([]); setItems([]); }, []);
  const refresh = useCallback(() => setItems(read()), []);
  return { items, clear, refresh };
}
