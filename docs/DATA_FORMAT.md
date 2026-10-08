# Chronoscope data format

Every historical fact in Chronoscope — who held what land, who lived when and
went where, who knew whom — is a plain JSON file under `src/data/records/`.
There is no database. Pull the branch and these files are on your disk;
edit them and `npm run validate` (or `npm run build`, which runs it first)
tells you immediately if something doesn't fit.

This document is the contract: the shape each file expects, a minimal real
example, and the rules `scripts/validate-data.mjs` enforces. Hand data in
this shape to anyone (or anything) working on the dataset and it can be
merged straight into the matching file.

## The one rule behind all of them

**Every claim needs a real, named source, and every source needs to be a
real, citable work.** Nothing is entered because it's "probably true" —
either a cited work says it, or it isn't in the data. Where the honest
answer is "we don't know", that's a legitimate value (`"unknown"` evidence,
or simply no entry at all) — it is never filled in with a guess.

## Files

| File | What it holds |
|---|---|
| `sources.json` | The works everything else cites |
| `people.json` | Every named person: identity, lifespan, relationships, journey |
| `places.json` | Every place with coordinates |
| `control.json` | Who held which place, from which year to which |
| `powers.json` | Display name + colour for every polity named in `control.json` or `unit-rules.json` |
| `events.json` | Dated historical events |
| `eras.json` | Named period labels shown on the timeline |
| `regions.json` | Sub-national administrative divisions (sarkar/pargana/district/...) |
| `unit-rules.json` | Dated whole-country/state rules (used for modern 1500+ territory, e.g. "Republic of India from 1947") |

---

## `sources.json`

```json
{
  "id": "sabhasad",
  "title": "Sabhāsad Bakhar",
  "author": "Krishnaji Anant Sabhasad",
  "kind": "near-contemporary",
  "dated": "c. 1694–1697",
  "note": "Earliest Marathi biography of Shivaji, written by a courtier from memory."
}
```

- `id` — short lowercase key, referenced everywhere else as a `sourceIds` entry.
- `kind` — one of `primary` (a document/inscription from the time itself),
  `near-contemporary` (written within living memory), `scholarship` (a modern
  historian's work).
- Add a source here **before** citing its id anywhere else — the validator
  rejects any `sourceIds` entry that doesn't resolve to a row in this file.

---

## `people.json`

One object per line (not pretty-printed — keeps diffs to one line per
person). Full shape:

```json
{
  "id": "baji-prabhu-deshpande",
  "uid": "CHR-P-0053",
  "name": "Baji Prabhu Deshpande",
  "gender": "male",
  "aliases": ["Bajiprabhu Deshpande"],
  "born": 1615,
  "bornApprox": true,
  "died": 1660,
  "role": "Maratha military commander",
  "house": "Deshpande",
  "father": "...",
  "mother": "...",
  "birthPlace": "...",
  "deathPlace": "Pavan Khind",
  "namesakes": [{ "name": "...", "life": "1696–1726", "note": "Not to be confused with..." }],
  "summary": "One or two sentences — what they're known for.",
  "phases": ["Youth & service", "Siege of Panhala", "Pavan Khind"],
  "relationships": [
    {
      "personId": "shivaji",
      "kind": "friend",
      "note": "Died holding Pavan Khind on 13 July 1660 so he could reach Vishalgad safely.",
      "sourceIds": ["sabhasad", "jedhe"]
    }
  ],
  "journey": [
    {
      "id": "bp3",
      "year": 1660,
      "place": "Pavan Khind",
      "lng": 73.93,
      "lat": 16.65,
      "label": "Death holding the pass",
      "phase": "Pavan Khind",
      "summary": "Held the narrow pass with a small rearguard...",
      "evidence": "documented",
      "routeEvidence": "corroborated",
      "routeNote": "optional — caveat about the route itself",
      "eventId": "pavan-khind-1660",
      "sourceIds": ["sabhasad", "jedhe"]
    }
  ]
}
```

### Required vs optional

Required: `id`, `uid`, `name`, `gender`, `aliases` (`[]` if none), `born`,
`died`, `role`, `summary`.

Everything else is optional — `house`/`father`/`mother`/`birthPlace`/
`deathPlace`/`namesakes` only when known; `relationships` and `journey` only
when you have real, sourced content for them. A person with no `journey` is
valid and normal — they just won't appear as a map marker, only in
relationship lists and event records.

### `id` and `uid`

- `id` — lowercase-kebab-case, used everywhere else to reference this
  person (`relationships[].personId`, `events.json` → `personIds`,
  `control.json` claims don't reference people, but journeys do).
- `uid` — `CHR-P-NNNN`, permanent, sequential, **never reused or renumbered**
  even if the person turns out to be a duplicate (merge the records instead;
  see `namesakes` for same-name-different-person cases). Next free number =
  `max(existing uids) + 1`. This is the one key that's collision-proof by
  construction — it's a counter, not derived from anything that could later
  turn out to be wrong or disputed. It never changes even if the person's
  dates get corrected.

#### Disambiguating `id` for a reused name

`id` defaults to a plain name slug (`shivaji`). When a name is reused by
more than one person in the dataset, make the *later*-added one's `id`
self-disambiguating instead of just appending a number:

```
<name-slug>-<born>-<died>[-<father's-id>]
```

- Dates: BCE as a plain negative-style suffix, `bc` not a minus sign (ids
  can't start with `-`) — e.g. `ashoka-304bc-232bc`. CE dates plain —
  `shivaji-ii-1696-1726`.
- If `born`/`died` alone still isn't enough to tell two same-name,
  same-era people apart, append the father's own `id` —
  `rajaram-ii-1726-1777-tarabai` style (use whichever parent is attested;
  `father` by default, `mother` if that's the attested one instead).
- Where a year itself is only approximate (`bornApprox`/`diedApprox`),
  use it in the id anyway — the flag on the record itself is what marks it
  approximate, the id just needs to be *stable*, not perfectly precise.
  Don't leave an ancient figure's id undisambiguated just because the date
  is fuzzy; a fuzzy-but-present date still disambiguates better than
  nothing.
- **Always add a matching `namesakes[]` entry on both records** — the id
  suffix is for machine disambiguation; `namesakes` is what tells a human
  reader "these are different people" in plain language. Do both, every
  time a name is reused.
- The *first* person to hold a plain name keeps the plain `id` — don't
  rename an existing id to add a suffix retroactively, since `id` is
  referenced from other records and relationships. Only the newly-added,
  name-colliding person gets the disambiguated form.

### `born` / `died`

Always a plain number (negative = BCE). Where the actual year is a
scholarly estimate rather than attested, set `bornApprox: true` /
`diedApprox: true` (both optional, default false) **and** say so in
`summary` — the flag alone isn't shown as text anywhere, the sentence is
what the reader actually sees.

### `relationships[]`

```ts
{
  personId: string;   // must be another person's `id`
  kind: 'family' | 'ally' | 'friend' | 'rival' | 'enemy' | 'mentor' | 'subordinate' | 'overlord';
  note: string;        // what the `kind` doesn't already say
  sourceIds: string[]; // at least one
}
```

**Not auto-mirrored.** If A and B have a relationship, add it on *both*
records — each side can carry its own note (e.g. A: "defeated him at
Plassey"; B: "defeated by him at Plassey"). `kind` doesn't have to match
either (a `mentor`'s own entry back is usually `subordinate`).

### `journey[]` — what makes a person a live map marker

```ts
{
  id: string;               // unique within this person's journey, e.g. "s4", "bp3"
  year: number;
  approxYear?: boolean;      // true if the year itself is traditional/disputed
  place: string;             // display name, doesn't need to match places.json
  lng: number;
  lat: number;
  label: string;             // short — shown on the timeline dot
  summary: string;           // one or two sentences
  phase: string;             // must be one of this person's own `phases[]`
  evidence: 'documented' | 'corroborated' | 'inferred' | 'disputed' | 'unknown';
  routeEvidence: 'documented' | 'corroborated' | 'inferred' | 'disputed' | 'unknown'; // evidence for the TRAVEL to get here, not the stay itself
  routeNote?: string;        // caveat about the route/date, when there is one
  eventId?: string;          // link to events.json for day-precision + cross-reference
  sourceIds: string[];
}
```

Stages don't need to be exhaustive — 2–4 well-sourced stages (birth, one or
two pivotal moments, death) is a complete, honest journey. A person is
placed "between" two stages by the app's own interpolation; you never need
to fill in guessed intermediate points.

**Link to `events.json` via `eventId` whenever the stage corresponds to a
dated event** (even one shared with other people, e.g. a battle). This is
what gives day-level precision instead of defaulting to 1 January of that
year, and it's what the validator uses to allow several people to
legitimately share one day.

---

## `places.json`

```json
{
  "id": "raigad",
  "name": "Raigad",
  "lng": 73.44,
  "lat": 18.234,
  "precisionKm": 0.5,
  "coordStatus": "verified",
  "coordSource": "OpenStreetMap (Nominatim): \"Raigad Fort\", retrieved 2026-10-06.",
  "names": [{ "name": "Rairi", "from": 1030, "to": 1656, "note": "Name before Shivaji's capture." }]
}
```

- `coordStatus: "verified"` requires `coordSource` naming where the
  coordinate came from. `"unverified"` is allowed without one, but is a
  weaker record — verify when you can.
- `precisionKm` — how far the point might be from the true site. Use a
  small number (0.5) for a located fort/city, larger for an
  approximately-known ancient site.
- `names[]` — only needed where the place was called something else in a
  given period (`from`/`to` years).

## `control.json` — who held what, when

```json
{
  "placeId": "raigad",
  "polity": "Mughal Empire",
  "from": 1526,
  "to": 1540,
  "sourceIds": ["baburnama", "akbarnama"],
  "under": "optional — overlord, if the holder acknowledged one",
  "division": "optional — internal province name",
  "capital": true,
  "note": "optional"
}
```

- `placeId` must exist in `places.json`. `polity` must exist in
  `powers.json` (exact string match — "Mughal Empire" is not "Mughal
  empire").
- `to` is **exclusive** — a claim `1526` to `1540` and the next claim
  starting exactly `1540` do not overlap.
- **Never two claims for the same place with overlapping `[from, to)`** —
  that's a build error, not a warning. Two sources disagreeing on who held
  something is a real historical dispute, which belongs as a note/disputed
  evidence state, not as silently-overlapping rows.
- A gap between one claim's `to` and the next claim's `from` is fine and
  common — it means "no attested holder for this span", which is an honest
  answer the validator just logs, not an error to eliminate at all costs.
  Don't fabricate a claim to close a gap you can't actually source.

## `powers.json`

```json
{ "name": "Mughal Empire", "family": "islamic", "colour": "#37be7a" }
```

`family` is just a legend grouping: `indic` | `islamic` | `european` |
`culture` (archaeological cultures, never spread to fill empty land) |
`other`. Every `polity` string used anywhere in `control.json` or
`unit-rules.json` needs exactly one matching entry here, or the map can't
colour it.

## `events.json`

```json
{
  "id": "pavan-khind-1660",
  "title": "Stand at Pavan Khind",
  "date": "1660-07-13",
  "precision": "day",
  "calendar": "julian",
  "place": "Pavan Khind",
  "lng": 73.93,
  "lat": 16.65,
  "summary": "One or two sentences.",
  "whyItMatters": "One sentence on the consequence.",
  "importance": "High",
  "evidence": "documented",
  "evidenceNote": "What the evidence does and does not establish.",
  "sourceIds": ["sabhasad", "jedhe"],
  "personIds": ["shivaji", "baji-prabhu-deshpande"],
  "category": "battle"
}
```

`category` is one of: `battle, siege, accession, death, birth, founding,
construction, treaty, religious, journey, political, protest,
independence, disaster, science` — it picks the map icon. `calendar` is
`julian` | `gregorian` | `as-cited` (the source doesn't say) — dates before
the Gregorian calendar's adoption in a given region are usually `julian`.

## `unit-rules.json` (modern/1500+ territory only)

```json
{ "country": "PAK", "onlyStates": ["gilgit"], "polity": "Gilgit-Baltistan", "from": 1947, "to": 2027, "note": "..." }
```

Used only for assigning whole present-day districts (country code, matched
against `country`/`match`/`onlyStates`/`exceptStates` fragments) to a
polity over a date range. **Later rules in the file win** when more than
one matches the same district. Everything before ~1500 is driven entirely
by `control.json` claims instead.

---

## Workflow

1. Add/edit the JSON by hand, or hand me (or anyone) data already in this
   shape — I can merge it directly, not re-derive it.
2. `npm run validate` — fails loudly on anything that breaks the rules
   above; lists gaps (informational) separately from errors (build-blocking).
3. `npm run build` — runs validate, then the full TypeScript + Vite build.
4. Check it live: `npm run dev`, jump to the right year/person with a deep
   link (`/?year=1674`, `/people/prataprao-gujar`).
