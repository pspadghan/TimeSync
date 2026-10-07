import type { JourneyStage, Person } from './types';

// A life is recorded as scattered attestations. Between two of them we do not invent
// movement: the person is carried forward at the last attested place and marked as inferred,
// unless the sources leave the interval open, in which case it is shown as unrecorded.
export interface Presence {
  kind: 'attested' | 'carried' | 'unrecorded';
  stage: JourneyStage;
  next?: JourneyStage;
  text: string;
}

export function presenceAt(person: Person, year: number): Presence | null {
  const stages = person.journey;
  if (!stages || year < person.born || year > person.died) return null;
  const here = stages.filter((s) => s.year === year).pop();
  if (here) return { kind: 'attested', stage: here, text: `Recorded at ${here.place} in ${year}: ${here.label.toLowerCase()}.` };
  const prev = stages.filter((s) => s.year < year).pop();
  const next = stages.find((s) => s.year > year);
  if (!prev) return null;
  const span = `Last recorded at ${prev.place} in ${prev.year}${next ? `; next at ${next.place} in ${next.year}` : ''}.`;
  if (next?.routeEvidence === 'unknown') return { kind: 'unrecorded', stage: prev, next, text: `Whereabouts not recorded. ${span}` };
  return { kind: 'carried', stage: prev, next, text: `Most likely still based around ${prev.place}. ${span} No source records a move in between.` };
}
