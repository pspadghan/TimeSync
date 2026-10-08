# Editing Chronoscope's data yourself

This is the practical walkthrough: which file to open, what to change, how
to check it worked. The full field-by-field schema is in
[`DATA_FORMAT.md`](./DATA_FORMAT.md) — this doc is "I want to do X, here's
exactly what to type."

Everything lives in `src/data/records/*.json` on your own machine once you
have the branch checked out. Open them in any text editor or VS Code.

## Before you start: see it live

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Two deep links you'll use constantly while
editing:
- `http://localhost:5173/?year=1660` — jump the map straight to a year
- `http://localhost:5173/people/shivaji` — jump straight to a person's page

Keep this running in a second terminal tab while you edit — most changes
show up the moment you save the file (hit refresh if not).

After any edit, before you trust it:

```bash
npm run validate
```

This catches almost every mistake instantly: an unknown source id, two
claims for the same place overlapping in time, a relationship pointing to
a person who doesn't exist, a journey stage outside someone's lifespan. Fix
whatever it reports and run it again. `npm run build` does the same check
plus the full TypeScript/Vite build — run that before you consider an edit
finished.

---

## "I want to correct a date, a place name, or a detail"

Find the record and edit the one field. Nothing else needs to change.

**A person's birth/death year is wrong** — open `people.json`, find their
line (search the file for their `"id"`), edit `"born"` or `"died"`. If the
correct year is itself not firmly settled, also set `"bornApprox": true` (or
`diedApprox`) and say why in `"summary"`.

**A place's name is wrong, or you want the period-correct name shown for a
given date** — open `places.json`. The top-level `"name"` is the modern
display name — fix it directly if it's wrong. If the place was called
something *different in a particular period* (not wrong, just period-
specific — e.g. Agra was once "Akbarabad"), that goes in the `"names"`
array on that place, not a change to `"name"` itself:

```json
"names": [{ "name": "Akbarabad", "from": 1566, "to": 1803, "note": "Renamed by Akbar; reverted after." }]
```

**A journey stage's date, place, or description is wrong** — open
`people.json`, find the person, find the stage inside their `"journey"`
array by its `"label"`, edit the field. If you're correcting the *location*
specifically, update both `"lng"` and `"lat"` — see "finding coordinates"
below.

**A territorial claim is wrong (wrong ruler, wrong dates)** — that's in
`control.json`, not `people.json`. Find the row by `"placeId"` and
`"polity"`, fix `"from"`/`"to"` or `"polity"`. If you're narrowing or
splitting a date range, make sure the edited and surrounding rows still
don't overlap — `npm run validate` will tell you immediately if they do.

In every case: if your correction changes *what the evidence shows* (not
just a typo), also update `"sourceIds"` to point at whatever actually
supports the corrected version, and/or add a word to `"note"` or
`"routeNote"` saying what changed and why.

---

## "I want to add an incident that isn't published anywhere"

This is the one case where you need to think about **sourcing honestly**
rather than skip it. The app's whole design is that every claim says
*where it came from* — that doesn't mean "only things on Wikipedia," it
means "say what kind of evidence this actually is," which family knowledge,
oral tradition, or a local account absolutely can be.

**Step 1 — add a source entry for where this comes from**, even if it's not
a book. Open `sources.json` and add an entry describing it honestly:

```json
{
  "id": "family-oral-2026",
  "title": "Family account, recorded 2026",
  "author": "your name or family name",
  "kind": "near-contemporary",
  "dated": "oral tradition, recorded 2026",
  "note": "Passed down in the family; not independently published. Treat as a single-source account."
}
```

(If it's genuinely a family tradition going back generations rather than
something documented at the time, that's a weaker evidentiary class than a
contemporary chronicle — that's fine, that's what the `evidence` field on
the stage itself is for. Say so plainly in the source's own `note` rather
than dressing it up as more than it is.)

**Step 2 — add the stage** to that person's `"journey"` in `people.json`,
citing it, and set `"evidence"` honestly (probably `"inferred"` or
`"disputed"` rather than `"documented"` for a single oral source — that's
not a demotion, it's accuracy, and the app shows evidence level transparently
rather than hiding it):

```json
{
  "id": "s14",
  "year": 1672,
  "place": "...",
  "lng": 0.0,
  "lat": 0.0,
  "label": "...",
  "phase": "...",
  "summary": "...",
  "evidence": "inferred",
  "routeEvidence": "unknown",
  "routeNote": "Recorded only in family tradition; not attested in the standard bakhars or chronicles.",
  "sourceIds": ["family-oral-2026"]
}
```

If the incident is a genuinely new *event* (something that happened, maybe
involving more than one person) rather than just a stop on one person's
journey, also add it to `events.json` (see `DATA_FORMAT.md`) and reference
it from the stage via `"eventId"` — that way it shows up on the map's event
layer too, not just this one person's page.

---

## "I want to add a whole new person from scratch"

1. **Pick an `id`** (lowercase-kebab-case, e.g. `yesubai`) and the next free
   `uid` — open `people.json`, find the highest existing `CHR-P-NNNN`, use
   the next number.

2. **Fill the required fields**: `id`, `uid`, `name`, `gender`, `aliases`
   (`[]` if none), `born`, `died`, `role`, `summary`. That alone is already
   a valid, complete person record — they'll show up in the People
   directory even with nothing else.

3. **Add `journey[]` stages** if you want them to appear as a tracked map
   marker. For each stage you need real coordinates:
   - **Finding coordinates**: open [Google Maps](https://maps.google.com) or
     [OpenStreetMap](https://openstreetmap.org), find the place, right-click
     it — both show you the exact latitude/longitude to copy. Use that for
     `"lng"`/`"lat"`.
   - Give each stage a `"phase"` that matches one entry in that person's own
     `"phases"` array (add phases there too as you go).
   - Cite a real source in `"sourceIds"` for every stage — see the previous
     section if the source isn't a published work.

4. **Add `relationships[]`** to connect them to people already in the
   dataset — and add the matching entry on *their* record too (not
   automatic — see `DATA_FORMAT.md`).

5. **Run `npm run validate`**, fix anything it flags, then `npm run dev`
   and check their page (`/people/<id>`) and a year they appear in
   (`/?year=<year>`) actually look right.

---

## Saving your changes back

You're editing the same files whether you do it by hand or I do it when you
describe something to me in chat — so either of these works, pick whichever
is easier in the moment:

- **Tell me the details in plain language** (a date, a place, a source, an
  incident) and I'll write it into the correct file in this exact format,
  validate it, and push it — same as everything so far in this session.
- **Edit the JSON yourself locally**, then commit and push to the same
  branch:
  ```bash
  git add src/data/records/people.json   # or whichever files you touched
  git commit -m "Describe what you corrected or added"
  git push origin claude/dazzling-rubin-22xrmb
  ```
  Next time I pull this branch I'll see your edits, same as you see mine.

Either way, **always run `npm run validate` before pushing** — it's the
thing standing between "an honest gap" and "a mistake that breaks the map."
