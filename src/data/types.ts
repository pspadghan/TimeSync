export type EvidenceState = 'documented' | 'corroborated' | 'inferred' | 'disputed' | 'unknown';

/** How precisely a date is actually known. Always use the finest one the evidence supports —
 * never fall back to `year` just because it's the common case; a battle with a recorded hour
 * of day should say `hour`, a treaty signed at a recorded minute should say `minute`. */
export type Precision = 'minute' | 'hour' | 'day' | 'month' | 'year';

/**
 * Dates are stored exactly as the cited scholarship gives them. `julian` = Old Style,
 * `gregorian` = New Style, `as-cited` = the literature does not state which.
 */
export type Calendar = 'julian' | 'gregorian' | 'as-cited';

export type Importance = 'High' | 'Medium';

// What kind of thing happened. Each gets its own icon (src/components/mapIcons.ts); 'battle'
// additionally switches between an older and a newer weapon glyph by the event's own year, so
// a line of pikemen doesn't represent a 20th-century engagement.
export const EVENT_CATEGORIES = [
  'battle', 'siege', 'accession', 'death', 'birth', 'founding', 'construction', 'treaty',
  'religious', 'journey', 'political', 'protest', 'independence', 'disaster', 'science',
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export interface Source {
  id: string;
  title: string;
  author: string;
  kind: 'primary' | 'near-contemporary' | 'scholarship';
  dated: string;
  note?: string;
}

export interface HistEvent {
  id: string;
  title: string;
  /** ISO yyyy-mm-dd; month/day are placeholders when precision is coarser. */
  date: string;
  precision: Precision;
  calendar: Calendar;
  place: string;
  lng: number;
  lat: number;
  /** True when the site itself is only approximately known. */
  approximateSite?: boolean;
  summary: string;
  whyItMatters: string;
  importance: Importance;
  evidence: EvidenceState;
  /** What exactly the evidence does and does not establish. */
  evidenceNote: string;
  sourceIds: string[];
  personIds: string[];
  sceneId?: string;
  /** What kind of event this was; picks the icon drawn for it (see src/components/mapIcons.ts). */
  category: EventCategory;
  image?: string;
}

export interface JourneyStage {
  id: string;
  year: number;
  approxYear?: boolean;
  place: string;
  lng: number;
  lat: number;
  label: string;
  summary: string;
  phase: string;
  evidence: EvidenceState;
  /** Evidence state of the route leading from the previous stage to this one. */
  routeEvidence: EvidenceState;
  routeNote?: string;
  eventId?: string;
  sourceIds: string[];
}

/** Someone a person record must never be merged with, even though the names collide. */
export interface Namesake {
  name: string;
  life: string;
  note: string;
}

export type RelationshipKind = 'family' | 'ally' | 'friend' | 'rival' | 'enemy' | 'mentor' | 'subordinate' | 'overlord';

/** A tie to another person on record — the social graph a life is actually lived inside, not
 * just the dated stages of one person's own journey. Each side of a relationship is its own
 * row (not auto-mirrored), so the two people can carry different notes on the same tie. */
export interface Relationship {
  personId: string;
  kind: RelationshipKind;
  /** What the kind does not already say: how they met, how it changed, how it ended. */
  note: string;
  sourceIds: string[];
}

export interface Person {
  id: string;
  /** Permanent Chronoscope identifier. Never reused, never changed when a name is corrected. */
  uid: string;
  name: string;
  /** Drives which of the two generic fallback map silhouettes is used when there is no
   * commissioned portraitIconUrl (see below) — not a claim about identity beyond that. */
  gender: 'male' | 'female';
  aliases: string[];
  house?: string;
  father?: string;
  mother?: string;
  birthPlace?: string;
  deathPlace?: string;
  namesakes?: Namesake[];
  born: number;
  /** True when `born` is the best scholarly estimate rather than an attested year. */
  bornApprox?: boolean;
  died: number;
  diedApprox?: boolean;
  role: string;
  summary: string;
  phases?: string[];
  journey?: JourneyStage[];
  /** Other people on record from this person's life: family beyond parents, allies, rivals,
   * enemies, mentors. Builds the web a biography sits inside instead of an isolated record. */
  relationships?: Relationship[];
  /** A commissioned portrait icon for this person's map marker, overriding the generic bust
   * glyph. Not used yet — every person currently draws the same shared silhouette in their own
   * colour (src/components/mapIcons.ts); this field exists so a specific likeness can be added
   * later without changing how the map renders people. */
  portraitIconUrl?: string;
}

export interface SceneChapter {
  id: string;
  title: string;
  kind: 'known' | 'unknown';
  shot: string;
  setting: string;
  /** Always a paraphrase of the situation — never presented as recorded speech. */
  paraphrase: string;
  interpretiveNote: string;
  narrator: string;
}

export interface Scene {
  id: string;
  eventId: string;
  title: string;
  dateLabel: string;
  place: string;
  setting: string;
  participants: string;
  relationship: string;
  image: string;
  imageAlt: string;
  reconstructionNote: string;
  hotspots: { id: string; label: string; x: number; y: number; note: string }[];
  chapters: SceneChapter[];
  sourceIds: string[];
}
