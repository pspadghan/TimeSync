# Architecture: the data store question, decided

You asked whether to standardize on JSON-in-the-repo, or move to NoSQL (or
something else) now, before more data piles up. Decision: **stay on
JSON + the git-diffable records files, with SQLite only as a disposable
query cache.** Not "for now, revisit later" — this is the right storage
model for what Chronoscope actually is, at every scale this project will
realistically reach. Here's the reasoning, so it doesn't need re-litigating
every few months.

## What's actually running today

Two layers, not one:

1. **`src/data/records/*.json`** — the real data. Hand-authored, git-
   versioned, human-reviewable in a diff. This is the only thing that's
   ever "the truth."
2. **`data/chronoscope.db`** — a SQLite file `server/api.mjs` rebuilds
   from scratch, from the JSON, every time the dev/preview server starts
   (see `server/api.mjs:25`, function `build()`). It's gitignored. Delete
   it and nothing is lost — it just regenerates. Its only job is answering
   "who held what in year X" and "where was person Y at timestamp Z"
   fast, without the browser re-scanning every record on every frame of
   playback.

Current size, for scale: 73 people, 193 places, 483 territorial claims,
74 events, 46 sources — **274 KB of JSON total.** SQLite rebuilds this
from a cold start in well under a second.

## Why this is the right model, not a stopgap

**The evidence/review workflow *is* the product.** Every claim in this
app carries sourced evidence, a "review pending" state is shown in the
header, and the whole point is that a change can be inspected before it's
trusted. A `git diff` on a JSON file **is** that review mechanism, for
free: you see exactly which field changed, who changed it, when, and can
revert one line without touching anything else. A database migration or a
NoSQL document update doesn't give you that — you'd have to build a
separate audit/review layer to get back what `git log -p` already gives
you today. Moving to a database doesn't add a capability here; it removes
one and asks you to rebuild it.

**NoSQL specifically solves a problem this project doesn't have.**
Document databases (MongoDB-style) earn their keep when: schemas vary wildly
row to row, write throughput is high and concurrent, or the dataset is too
large for one process to hold in memory. None of that is true here — every
person/place/claim has the same handful of optional fields (documented in
`DATA_FORMAT.md`), writes happen one contributor at a time via a PR, and
the entire dataset is a quarter of a megabyte. A NoSQL migration would add
a hosted database to operate (backups, access control, uptime) in exchange
for nothing this project currently needs.

**SQL is already in the stack, and it's already doing the hard part.**
The queries that actually matter — "attested places in year X," "track a
person's position at timestamp Z by interpolating their nearest recorded
appearances" — are exactly what SQL's indexes and range queries are built
for (see the `claim_span` and `appearance_span` indexes in `server/api.mjs`).
Swapping to a document store would mean re-implementing that range logic
by hand.

## When to actually revisit this

Not "never" — concrete triggers, so this isn't a vague deferral:

- **The JSON files themselves become unreviewable** — a single PR routinely
  touches thousands of lines because of unrelated bulk edits. (Mitigation
  before that: split `people.json`/`control.json` by era or region into
  multiple files, which the loaders in `src/data/*.ts` can be pointed at
  without changing the record shape at all. Still JSON, just more files.)
- **The SQLite rebuild-on-start becomes slow enough to feel it** — realistically
  tens of thousands of rows away. SQLite comfortably handles millions of
  rows; the current bottleneck would be JSON.parse of a huge single file,
  which is a "split the file" problem, not a "change database" problem.
- **Multiple people need to write to the same record at the same instant**
  (true concurrent editing, not sequential PRs) — a file-based format
  can't arbitrate that; a real database with transactions can. This is the
  one trigger that's a genuine category change, not just more data.

None of these are close. Don't preempt them.

## The standardized inventory (what we store vs. what we show)

This is already written up properly in [`DATA_FORMAT.md`](./DATA_FORMAT.md)
— the schema for every record type. The short version, as the
"what do we need to store / what do we need to show" standard going
forward:

| Stored (source of truth, JSON) | Shown (derived, never itself stored) |
|---|---|
| A person's identity, lifespan, relationships, journey stages | A person's *current* position at a given timeline instant — computed by interpolation (`useTracks`), never stored as its own fact |
| A territorial claim (place, polity, date range, sources) | The map's coloured fill and solid boundary line for a given year — computed by `buildGrid`/`zoneOutline`, never stored as a polygon-per-year |
| An event (dated, placed, sourced) | "Events in current map extent" — a filtered view, computed on the fly |
| A relationship between two people | "People in their life" — rendered from the same rows, both directions |
| A source (title, author, kind) | A consensus label ("Settled · 5 works agree") — computed from how many claims cite it |

The pattern to keep standardizing on: **store the atomic, sourced fact;
compute every aggregate/visual view from it at read time.** Don't add a
new stored field for something derivable from existing fields — that's
how two numbers quietly disagree six months later. Every new feature
(person search, a war/category filter, a relationship-count badge) should
be a new *view* over the existing records, not a new thing to keep in
sync by hand.
