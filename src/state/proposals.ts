import { useCallback, useState } from 'react';
import type { Status } from './contributions';

// Researcher proposals other than a new source: corrections, new people, events, places,
// routes and merges. Each states what should change, why, and the works that support it.
// Nothing here alters the records until a reviewer approves it and it is entered.
export const PROPOSAL_TYPES = {
  correction: { title: 'Correct claim', ask: 'Which record is wrong, and what should it say?', minSources: 2, review: 'Senior review' },
  person: { title: 'Suggest person', ask: 'Who is this, with dates, parentage and other names, so they cannot be confused with a namesake?', minSources: 1, review: 'Identity review' },
  event: { title: 'Add event', ask: 'What happened, where and on what date? State how precise the date is and which calendar it is in.', minSources: 1, review: 'Event review' },
  place: { title: 'Add place', ask: 'The place, its period names, coordinates and how precise they are.', minSources: 1, review: 'Spatial review' },
  route: { title: 'Propose route', ask: 'Whose journey, between which dated stages, and what supports each leg?', minSources: 1, review: 'Spatial review' },
  merge: { title: 'Merge duplicate', ask: 'Which two records are the same, and which identity should be kept?', minSources: 1, review: 'Data steward review' },
} as const;
export type ProposalType = keyof typeof PROPOSAL_TYPES;

export interface Proposal {
  id: string;
  type: ProposalType;
  status: Status;
  savedAt: number;
  subject: string;
  change: string;
  reasoning: string;
  /** One supporting work per line, with page or folio. */
  sources: string;
  reviewNote?: string;
}

const KEY = 'chronoscope.proposals';
function read(): Proposal[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function useProposals() {
  const [items, setItems] = useState<Proposal[]>(read);
  const write = useCallback((next: Proposal[]) => {
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: proposals still exist for this session
    }
  }, []);
  const save = useCallback((p: Proposal) => write([{ ...p, savedAt: Date.now() }, ...read().filter((x) => x.id !== p.id)]), [write]);
  const remove = useCallback((id: string) => write(read().filter((x) => x.id !== id)), [write]);
  return { items, save, remove };
}

export const sourceLines = (p: Proposal) => p.sources.split('\n').map((s) => s.trim()).filter(Boolean);

/** What is missing. `blocking` items stop submission. */
export function check(p: Proposal): { text: string; blocking: boolean }[] {
  const out: { text: string; blocking: boolean }[] = [];
  const need = PROPOSAL_TYPES[p.type].minSources;
  if (!p.subject.trim()) out.push({ text: 'Say what this is about.', blocking: true });
  if (!p.change.trim()) out.push({ text: 'Describe the change you are proposing.', blocking: true });
  if (sourceLines(p).length < need) out.push({ text: `At least ${need} supporting ${need === 1 ? 'work is' : 'works are'} required.`, blocking: true });
  if (!p.reasoning.trim()) out.push({ text: 'No reasoning given: explain how the sources support the change.', blocking: false });
  if (sourceLines(p).some((s) => !/\d/.test(s))) out.push({ text: 'A source has no page, folio or year in it.', blocking: false });
  return out;
}
