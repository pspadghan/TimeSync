# Bulk-adding data with an AI

Copy one of the prompts below into any AI (me, ChatGPT, whatever), fill in
the `[brackets]`, paste its answer into the matching file. This doc exists
so you don't have to retype the schema every time.

## The trick that makes manual pasting foolproof

**Order inside each JSON array doesn't matter anywhere in the app** — not
for people, places, claims, events, or sources. Nothing is looked up by
position, only by `id`. So instead of carefully appending at the end of a
huge file (fiddly — you have to move the trailing comma), always paste new
entries **right after the opening `[` on line 1**:

```json
[
  {"id":"your-new-person", ...},
  {"id":"another-new-person", ...},
  {"id":"shivaji", ...}            ← everything that was already here, untouched
  ...
]
```

Just add a comma after your last new entry (since existing content
follows), and never touch anything below it. Always finish with
`npm run validate` — it'll catch a dropped comma or bracket instantly.

## Avoiding reference-key conflicts (same name, different person)

Every person has **two** keys, and this is exactly what stops two
different people from ever being confused, even if they share a name:

- **`id`** — the string everything else points to
  (`relationships[].personId`, `events.json`'s `personIds`). Must be
  unique. If a name is reused across history, make the `id`s distinct:
  `shivaji` and `shivaji-ii-kolhapur`, not `shivaji` twice.
- **`uid`** (`CHR-P-NNNN`) — permanent, sequential, assigned once and never
  reused or renumbered, even years later. This is the one true "this is
  definitely the same specific person" key.
- **`namesakes[]`** — put the *other* same-named person here, on **both**
  records, with their own life dates and a one-line note, so the app
  explicitly shows "not the same person as..." instead of silently risking
  a mix-up. Chronoscope already does this (Shivaji I's record lists his
  grandson Shivaji II of Kolhapur as a namesake, and vice versa).

**Tell the AI your current highest `uid` number** (check the bottom of
`people.json`, or ask me) so it assigns the next ones correctly instead of
guessing — the prompts below have a placeholder for this.

---

## Prompt: bulk-add people

```
I'm adding historical people to a structured JSON dataset (Chronoscope,
an Indian history app). Give me ONLY a JSON array of new person objects,
no commentary, ready to paste directly into the file.

Each object must have exactly this shape:
{
  "id": "lowercase-kebab-case-unique-id",
  "uid": "CHR-P-NNNN",
  "name": "Full name",
  "gender": "male" | "female",
  "aliases": ["other names they're known by"],
  "born": <year, negative = BCE>,
  "bornApprox": true   // ONLY include this field if the year is an estimate, omit otherwise
  "died": <year>,
  "diedApprox": true   // same rule as bornApprox
  "role": "one short phrase",
  "house": "family/dynasty name",   // omit if not applicable
  "father": "name",                  // omit if unknown
  "mother": "name",                  // omit if unknown
  "birthPlace": "place name",        // omit if unknown
  "deathPlace": "place name",        // omit if unknown
  "summary": "1-3 sentences. If any date is an estimate, say so here in plain English too, not just the Approx flag.",
  "phases": ["Phase name 1", "Phase name 2", ...],  // life stages, your own labels
  "relationships": [
    {
      "personId": "id-of-another-real-person-in-this-batch-or-named-below",
      "kind": "family" | "ally" | "friend" | "rival" | "enemy" | "mentor" | "subordinate" | "overlord",
      "note": "what this specific tie was",
      "sourceIds": ["source-id"]
    }
  ],
  "journey": [
    {
      "id": "short-unique-id-within-this-person-e.g.-p1",
      "year": <year>,
      "approxYear": true,     // only if the year itself is traditional/disputed
      "place": "place name",
      "lng": <real longitude, decimal degrees>,
      "lat": <real latitude, decimal degrees>,
      "label": "short label, shown on a timeline dot",
      "phase": "must exactly match one entry in this person's own phases[] above",
      "summary": "1-2 sentences",
      "evidence": "documented" | "corroborated" | "inferred" | "disputed" | "unknown",
      "routeEvidence": "documented" | "corroborated" | "inferred" | "disputed" | "unknown",
      "sourceIds": ["source-id"]
    }
  ]
}

Rules:
- born/died/role/summary/id/uid/name/gender/aliases are REQUIRED on every person.
- relationships and journey are optional but include them whenever you
  have real, specific, dated information — don't leave them empty for
  significant figures.
- Use REAL historical facts only. If you're not confident of an exact
  year, use your best estimate AND set the Approx flag AND say so in the
  summary — never state a guess as if it were certain.
- Every coordinate must be a real place's actual location, not a rough
  guess at a region.
- sourceIds: name the actual historical work/chronicle this comes from
  (e.g. author/title), not a vague "history books". List each distinct
  source you used at the end, OUTSIDE the JSON array, as a separate list
  with: id (short key), title, author, kind (primary / near-contemporary /
  scholarship), approximate date — I'll add any that aren't already in my
  sources file.
- uid: start at CHR-P-[NEXT NUMBER] and increment by 1 for each person in
  order.
- id: must not collide with any of these existing ids: [PASTE EXISTING IDS
  YOU WANT TO AVOID, OR SAY "none known, just make them clearly distinct"]
- If any person shares a name with someone already in my dataset, add a
  namesakes entry on their record: [{"name":"...", "life":"YYYY–YYYY",
  "note":"..."}], and tell me so I can add the matching one on the
  existing person's record too.

Topic: [DESCRIBE WHO YOU WANT — e.g. "10 Maratha sardars who served under
Shivaji, each with at least their joining date/place and how their service
ended"]
```

## Prompt: bulk-add places

```
Give me ONLY a JSON array of place objects for a historical atlas, ready
to paste into a file, no commentary.

Shape:
{
  "id": "lowercase-kebab-case-unique-id",
  "name": "Current/common display name",
  "lng": <real longitude>,
  "lat": <real latitude>,
  "precisionKm": <how many km the point might be off by - use 0.5 for a precisely located site>,
  "coordStatus": "verified",
  "coordSource": "say where the coordinate came from, e.g. OpenStreetMap entry name"
}

Add a "names" array ONLY for places that were called something different
in a specific historical period:
"names": [{"name":"period name","from":<year>,"to":<year>,"note":"why it changed"}]

Rules: real coordinates only, one object per place, no duplicate ids.
Existing ids to avoid colliding with: [PASTE LIST, OR "none known"]

Places needed: [LIST THE PLACE NAMES]
```

## Prompt: bulk-add territorial claims (who held what, when)

```
Give me ONLY a JSON array of territorial-control claim objects, ready to
paste into a file, no commentary.

Shape:
{
  "placeId": "must match an existing or newly-added place id",
  "polity": "exact name of the ruling power",
  "from": <year power began holding it, negative = BCE>,
  "to": <year power stopped holding it - EXCLUSIVE, i.e. the next claim can start exactly here>,
  "sourceIds": ["source-id"],
  "capital": true,     // only if this was that power's capital, omit otherwise
  "under": "overlord name",   // only if they held it as a vassal, omit otherwise
  "note": "optional - anything worth flagging, e.g. approximate dates"
}

Critical rule: for any one placeId, claims must NEVER overlap in time.
Check your own output for this before giving it to me.

List each source you used (id, title, author, kind, approximate date) at
the end, outside the JSON.

Existing polity names already in my powers.json, reuse exactly if it's the
same power: [PASTE RELEVANT ONES, OR "tell me every polity name you use so
I can check/add colours for them"]

Claims needed: [DESCRIBE — e.g. "who held Pune, Satara, and Kolhapur from
1818 (fall of the Peshwas) to 1947"]
```

## Prompt: bulk-add events

```
Give me ONLY a JSON array of event objects, ready to paste into a file,
no commentary.

Shape:
{
  "id": "lowercase-kebab-case-unique-id",
  "title": "Short title",
  "date": "YYYY-MM-DD",   // use the best-attested day; if only the year is known, use YYYY-01-01 and set precision to "year"
  "precision": "day" | "month" | "year",
  "calendar": "julian" | "gregorian" | "as-cited",
  "place": "place name",
  "lng": <real longitude>,
  "lat": <real latitude>,
  "summary": "1-2 sentences, what happened",
  "whyItMatters": "1 sentence, the consequence",
  "importance": "High" | "Medium",
  "evidence": "documented" | "corroborated" | "inferred" | "disputed" | "unknown",
  "evidenceNote": "what the evidence does and doesn't establish - especially important if evidence is disputed/inferred",
  "sourceIds": ["source-id"],
  "personIds": ["id-of-person-involved", "..."],
  "category": "battle" | "siege" | "accession" | "death" | "birth" | "founding" | "construction" | "treaty" | "religious" | "journey" | "political" | "protest" | "independence" | "disaster" | "science"
}

List sources used at the end, outside the JSON (id, title, author, kind,
approximate date).

Existing person ids to reference if they were involved: [PASTE RELEVANT
ONES]

Events needed: [DESCRIBE]
```

---

## After pasting the AI's output in

1. Paste the new entries right after the opening `[` as shown above.
2. If the AI listed new sources you don't already have, add those to
   `sources.json` **first** (same trick — paste after its opening `[`).
3. `npm run validate` — fix anything it flags. The most common one: a
   `sourceIds` entry that doesn't match any id in `sources.json` (usually
   means step 2 was missed, or the AI invented an id that doesn't match
   what you actually added).
4. `npm run dev`, check a person's page or the right year on the map.
5. Commit and push (or hand the pasted result to me and I'll do steps
   2–5 and push it).
