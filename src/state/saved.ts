import { useCallback, useState } from 'react';
import type { Scale } from '../data/time';

export interface SavedMoment {
  id: string;
  ms: number;
  scale: Scale;
  eventId?: string;
  note?: string;
  visibility?: Visibility;
  savedAt: number;
}

export type Visibility = 'private' | 'team' | 'public';

const KEY = 'chronoscope.saved';

function read(): SavedMoment[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function useSaved() {
  const [items, setItems] = useState<SavedMoment[]>(read);

  const write = useCallback((next: SavedMoment[]) => {
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: the list still works for this session
    }
  }, []);

  const save = useCallback(
    (m: Omit<SavedMoment, 'id' | 'savedAt'>) => write([{ ...m, id: `${m.ms}-${m.eventId ?? 'moment'}`, savedAt: Date.now() }, ...read().filter((x) => x.id !== `${m.ms}-${m.eventId ?? 'moment'}`)]),
    [write],
  );
  const remove = useCallback((id: string) => write(read().filter((x) => x.id !== id)), [write]);

  return { items, save, remove };
}
