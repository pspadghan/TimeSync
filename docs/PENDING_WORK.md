# Pending work (session handoff)

Snapshot at the end of this session: **288 people**, **133 events**, 234 journey
stages still at year-only precision (not necessarily a problem — see below).

This file exists so the next session (or the next person editing the data)
doesn't have to re-derive what's done, what's half-done, and what's still
open. Update or delete entries here as they're finished instead of leaving
them stale.

## Not yet run before the last two commits

The last two commits (adding Lakhuji Jadhav/Mata Gujri, and this file) were
pushed **without** running `node scripts/validate-data.mjs`, per an explicit
instruction mid-session to stop spending turns on build/validate cycles and
keep adding data instead. Before trusting the data again:

```
node scripts/validate-data.mjs
```

Nothing in those two commits touched events.json's structure in a way likely
to break anything, but it hasn't been checked, so don't assume it's clean.

## Known real gaps, not yet filled

- **Duplicate events beyond what's been cleaned up.** Found and fixed three
  rounds of duplicate events this session (`chittor-1303`/`chittorgarh-1303`,
  `burhanpur-1631`/`mumtaz-death-1631`, `meerut-1857`/`meerut-mutiny-1857`),
  each time by independently researching and adding something that already
  existed under a different id. The validator now catches same-day-and-place
  duplicates automatically (haversine distance < 25km), but it's only as good
  as that heuristic — a duplicate dated differently, or placed further apart
  (e.g. one event using a city's coordinates and another using a specific
  battlefield 30km outside it), would still slip through. Worth a manual skim
  of `events.json` titles sorted alphabetically at some point to catch any
  that the date+distance check can't.

- **234 bare year-only journey stages.** Checked via:
  ```js
  const p = require('./src/data/records/people.json');
  const bare = [];
  p.forEach(x => (x.journey||[]).forEach(s => { if (!s.eventId) bare.push(x.id+' | '+s.year+' | '+s.label); }));
  ```
  Most of these are genuinely year-only in every source (ancient/early-medieval
  figures where no chronicle gives a day) and should stay that way — forcing a
  fabricated day would violate the project's own evidence standards. But a
  real subset of the remaining list is early-modern/modern and likely *does*
  have a documented day somewhere (Mughal, Maratha, and British Raj-era
  figures especially). This session worked through roughly 60 of the highest-
  value ones via targeted web search (see commits from the "web-verified
  precise dates" series) — plenty are left. Re-run the script above and work
  through what's left in batches, same pattern: web-search the specific
  battle/death/event, cross-check 2+ sources, note disagreement honestly in
  `evidenceNote` rather than picking one silently, create or find the event,
  link every person involved into its `personIds`, link their own journey
  stage via `eventId`.

- **Named-but-missing people beyond father/mother fields.** This session
  found Nur Jahan, Mariam-uz-Zamani, Asaf Khan, Lakhuji Jadhav, and Mata Gujri
  by scanning every person's `father`/`mother` text field for a name that
  doesn't match any real person record's `name` or `aliases`. That scan is
  now exhausted (one cosmetic false-positive pair remains: `shivaji`'s/
  `shahaji`'s short-form names used in a few `father` fields don't match
  their full stored names — harmless, not a real gap, low priority to fix).
  The same technique hasn't yet been applied to **relationship notes and
  summary text** — e.g. a person's `summary` or a relationship's `note` field
  mentioning someone by name who was never added as their own record. That's
  a richer but noisier search (free text, not a structured field) and wasn't
  attempted this session.

- **"Zero named ruler" sweep of `control.json` polities is believed complete**
  but wasn't re-verified at the very end of this session. Re-run:
  ```js
  const claims = require('./src/data/records/control.json');
  const people = require('./src/data/records/people.json');
  const names = people.map(p=>p.name+' '+(p.aliases||[]).join(' ')).join(' | ').toLowerCase();
  const byPolity = {};
  claims.forEach(c=>{ byPolity[c.polity] = (byPolity[c.polity]||0)+1; });
  // then spot-check each polity name against `names` the way earlier batches did
  ```
  to confirm nothing regressed or was missed in the ~90 polities checked.

- **Other "entirely missing era" gaps, beyond the ones found this session.**
  The 1857 Revolt, the Bhagat Singh/HSRA revolutionary wing, and most of the
  Indian National Congress's pre-Gandhi founders all had **zero** people before
  this session, despite being major and well-documented. They were invisible
  to the polity-based sweep above because a rebellion or a political
  movement isn't a `control.json` "polity." Likely similarly-missing threads,
  not yet checked:
  - Khilafat Movement, the Ali Brothers (Shaukat Ali, Mohammad Ali)
  - Chauri Chaura incident (1922)
  - Simon Commission beyond Lajpat Rai's death (the Commission members
    themselves, the all-party response)
  - Royal Indian Navy Mutiny (1946)
  - Direct Action Day and the Calcutta/Noakhali riots (1946)
  - Bengal famine (1943) — Lord Linlithgow, the administrative response
  - INA trials (Red Fort trials, 1945-46) beyond Bose himself
  - Partition's actual 1947 transition figures beyond the already-covered
    Nehru/Jinnah/Patel/Mountbatten-if-present (check whether Mountbatten,
    Radcliffe of the Radcliffe Line, or Liaquat Ali Khan exist yet)

## Framework / tooling notes for whoever continues this

- `scripts/validate-data.mjs` now checks: place/claim structure (pre-existing),
  person id/uid uniqueness, relationship integrity, **event id uniqueness,
  event personIds/sourceIds referential integrity, and duplicate-event
  detection by date+distance** (all added this session). If you add new kinds
  of records, consider whether they need the same treatment.
- Standard workflow for a data batch: write a one-off script to
  `scripts/tmp-add-*.mjs` (or the scratchpad dir), run it, run
  `node scripts/validate-data.mjs`, fix anything it flags, commit with the
  attribution footer, push. Skip the `npm run build` / dev-server verification
  step unless something about the *rendering* pipeline itself is in question
  (not just the data) — the user asked this session to stop spending turns on
  that for ordinary data additions.
- Every new event needs real sourceIds and, ideally, a day-level date backed
  by at least one cross-checked web source; when sources disagree, say so in
  `evidenceNote` rather than silently picking one.
