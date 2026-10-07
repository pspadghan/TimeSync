import { useCallback, useState } from 'react';
import { controlClaims, type ControlClaim } from '../data/control';
import { events } from '../data/events';
import { formatEventDate } from '../data/time';

// Researcher submissions. A submitted source counts toward a claim's consensus only after
// a reviewer approves it; until then it is shown as pending and changes nothing on the map.
export type Status = 'draft' | 'submitted' | 'approved' | 'returned';

export interface SourceContribution {
  id: string;
  status: Status;
  savedAt: number;
  targetKey: string;
  sourceType: string;
  title: string;
  author: string;
  publication: string;
  page: string;
  language: string;
  translation: string;
  excerpt: string;
  digitizedCopy: string;
  rights: string;
  link: string;
  reviewNote?: string;
}

/** Something a source can be cited for: a territory claim or an event. */
export interface Target {
  key: string;
  kind: 'Territory claim' | 'Event';
  label: string;
  where: string;
  when: string;
  sourceIds: string[];
}

export const claimKey = (c: ControlClaim) => `claim:${c.placeId}:${c.polity}:${c.from}`;

export const targets: Target[] = [
  ...controlClaims.map((c) => ({
    key: claimKey(c), kind: 'Territory claim' as const,
    label: `${c.place} held by ${c.polity}`,
    where: `${c.place} · ${c.lat.toFixed(3)}°N ${c.lng.toFixed(3)}°E`,
    when: `${c.from}–${c.to > 1800 ? 'after 1800' : c.to}`,
    sourceIds: c.sourceIds,
  })),
  ...events.map((e) => ({
    key: `event:${e.id}`, kind: 'Event' as const,
    label: e.title,
    where: `${e.place} · ${e.lat.toFixed(3)}°N ${e.lng.toFixed(3)}°E`,
    when: formatEventDate(e),
    sourceIds: e.sourceIds,
  })),
];
export const targetByKey = new Map(targets.map((t) => [t.key, t]));

const KEY = 'chronoscope.contributions';

function read(): SourceContribution[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function useContributions() {
  const [items, setItems] = useState<SourceContribution[]>(read);
  const save = useCallback((c: SourceContribution) => {
    const next = [{ ...c, savedAt: Date.now() }, ...read().filter((x) => x.id !== c.id)];
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: the submission still exists for this session
    }
  }, []);
  const remove = useCallback((id: string) => {
    const next = read().filter((x) => x.id !== id);
    setItems(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }, []);
  return { items, save, remove };
}

/** Checks a reviewer would otherwise have to make by hand. `blocking` ones stop submission. */
export function validate(c: SourceContribution): { text: string; blocking: boolean }[] {
  const out: { text: string; blocking: boolean }[] = [];
  const need = (ok: string, text: string, blocking = false) => { if (!ok.trim()) out.push({ text, blocking }); };
  need(c.title, 'A title is required.', true);
  need(c.author, 'An author or holding archive is required.', true);
  need(c.targetKey, 'Link the source to the claim or event it supports.', true);
  need(c.page, 'No page or folio given: nobody can check the citation without one.');
  need(c.excerpt, 'No excerpt given: quote the passage that supports the claim.');
  need(c.publication, 'No edition or date given.');
  need(c.rights, 'Rights not stated: the excerpt cannot be shown publicly until they are.');
  if (c.translation.trim() && !c.language.trim()) out.push({ text: 'A translation is named but the original language is not.', blocking: false });
  return out;
}

export const citation = (c: SourceContribution) =>
  [c.author.trim() && `${c.author.trim()}.`, c.title.trim() && `${c.title.trim()}${c.page.trim() ? `, ${c.page.trim()}` : ''}.`, c.publication.trim() && `${c.publication.trim()}.`].filter(Boolean).join(' ') || 'Fill in the form to see the citation.';
