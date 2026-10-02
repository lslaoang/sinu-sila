# Sino Sila? PH Officials

Static site of public records on Philippine officials. Rule: no record without a source link.

**Covers so far:** the 24 senators of the 20th Congress and the bills they authored (snapshot retrieved 2026-10-01).

## Run

```bash
python3 -m http.server   # then open http://localhost:8000
python3 validate.py      # checks every record has a source_url and a valid type
```

Deploy anywhere static (GitHub Pages, Netlify, Cloudflare Pages). No build step.

## Data

| File | Contents | Source |
|---|---|---|
| `data/officials.json` | Senators: name, position, `lis_codes`, records (each with `source_url`, `retrieved`) | https://senate.gov.ph/senators/20-congress-senators |
| `data/bills.json` | Per senator: total bills, count per month, count per status, 5 latest bills | https://senate.gov.ph/legislative-documents/bills |
| `data/laws.json` | Bills approved by the President / lapsed into law / enrolled, with the Senate's author, co-author and co-sponsor roles | https://senate.gov.ph/legislative-documents/bills (filtered by status) |
| `data/education.json` | Schools, degrees and years per senator; every item has its own `source_url` | Senate profile biography (12 senators) or Wikipedia (the other 12, whose Senate bios omit schooling) |
| `data/house.json` | House of Representatives members (317 + 1 vacant seat): name, constituency, kind, party, bloc, leadership role, Commons photo with credit link; every record cites the exact Wikipedia revision | `python3 tools/import_house.py` (Wikipedia list of current members) |
| `photo` in `officials.json` | Senator photo URL on senate.gov.ph | `/hq/senators/congress/28` (`image_upload.file_url`) |

"Bills authored" counts bills where the Senate lists the senator as author. "Laws backed" counts enacted bills (approved by the President, lapsed into law, or consolidated with a law) where the senator is author, co-author or co-sponsor, and the profile shows which role. A Senate bill folded into another bill is not detected unless the Senate marks it so. The Senate's own per-senator stats (`bills_passed_into_law`, `authored_bills`) are stale (all zero for laws), so they are not used.

**Education** only records what the cited sources state, and each item can list several source links. Twelve senators' entries come from their Senate profile bio (not independently cross-checked). The other twelve, whose Senate bios omit schooling, were first taken from Wikipedia and then cross-checked on 2026-10-01 against GMA candidate profiles, UP sa Halalan, news and fact-check outlets and the senators' own sites. Unsupported claims were dropped (e.g. Legarda's UCLA courses, Marcoleta's "cum laude" and "certificate"), and where sources disagree the entry says so (e.g. Bong Go's college, Marcoleta's doctorate year). Some official pages (Senate bios, Inquirer, Rappler) returned 403 to the checking tool, so a human check against those and against university records is still worth doing before launch. Contested items (Imee Marcos) are shown with institutional statements and a neutral note, without editorial wording.

**Scope is the Senate plus the House of Representatives for now**, with nationwide search as the goal (see below). Senate data is rich (bills, laws, education); House data is a first-pass roster only. It rests on Wikipedia alone until each member is cross-checked against a second source (GMA candidate profiles, UP sa Halalan, COMELEC). House portraits are free-licensed Wikimedia Commons files, credited on each profile; check each file's licence before launch. The House website (congress.gov.ph) sits behind a Cloudflare bot check, so it is not used.

**Political families:** pulitiklan.com maps relatives by place, citing sources such as the DBM 2026 Government Directory and PCIJ. It has no stated reuse terms, so its data is not copied. `python3 tools/link_pulitiklan.py` matches our people to its published family-page URLs by surname and place, keeps a link only if the person's name appears on that page (page text is used for the check and discarded), and stores URLs only in `data/pulitiklan.json` (208 links: 190 House, 18 Senate). Profiles show it as a clearly labelled link-out. Our own relationship layer, built from public documents with our own source links, is still to do.

**House audit (2026-10-02):** a stratified sample of 32 members was checked against non-Wikipedia sources (details in `data/house.json` `_meta.audit`). Seats held up; party labels are time-dependent (2026 party switching), "took office" dates from Wikipedia were unreliable (records now use the 20th Congress start), and leadership roles are incomplete. Two sampled members face court proceedings reported by news outlets; charges are allegations, not findings, and are not yet recorded on the site (needs careful, sourced wording).

**Homepage interactions** (seating chart sized by bills or laws, "where they studied" highlight) are computed in the browser from the data files. The school filter counts any non-honorary item whose school matches (Ateneo, UP, La Salle, UST, Harvard, UE, PMA, Georgetown) and skips items flagged `"match": false` in `education.json` (disputed, unconfirmed or single-source).

**Photos** are hotlinked from senate.gov.ph in the visitor's browser (scripts get HTTP 403, so they are not downloaded or stored here). If an image fails, the initials avatar stays. Confirm reuse terms with the Senate.

## Court cases and proceedings

`data/cases.json` records criminal, administrative and election cases, and rulings on public acts, for lawmakers' whole public careers. It publishes real people's legal history, so the rules are strict:

- Each case is a timeline of events, each event with its own source links. A case needs **two independent outlets or one official court/Ombudsman page** (`validate.py` enforces this).
- Wording is neutral: charges are "alleged", guilt is stated only where a court or the Ombudsman decided, and dismissals, acquittals, appeals and the person's own response are recorded alongside charges. Profiles carry a standing note (allegation, presumption of innocence, preventive suspension is not a finding of guilt).
- A profile says "No court cases found in the sources checked on <date>" only for people in `_meta.checked`; everyone else says "not yet checked". Absence of a result is never presented as a clean record.
- Scope excludes private family or business disputes unless they became a public-office matter.

Coverage so far (2026-10-02): 28 cases across 24 lawmakers, 46 people actually checked, 295 not yet checked. Each published case's sources were opened and read by a person (not just taken from an agent's summary). That check corrected the agents more than once (for example, *Guy v. Tulfo* is a damages ruling, not a reinstated conviction). People with only single-outlet leads are left "not yet checked" instead of being shown as clear. Institutional disputes between lawmakers (for example the June 2026 petitions over the Senate leadership session) are held out until their outcome is clear; the agents' search budgets also ran short, so many House members still need a proper pass in smaller batches.

Workflow: research agents (`politician-researcher`) screen batches of people and return strict JSON; `python3 tools/ingest_cases.py report.json` validates and merges it (single-outlet items go to the git-ignored `review/unconfirmed.json`, never published); every published case should then be spot-checked against its sources before committing. Needed before launch: a Philippine lawyer's review, a visible corrections and right-of-reply channel, and a refresh routine (case statuses go stale quickly).

## Refreshing the data (manual)

The Senate site blocks plain scripts (HTTP 403) but loads normally in a browser. Its pages read JSON from:

- Senators: `/hq/senators/congress/28?per_page=100`
- Bills: `/lis/documents_v2?document_type=bills&congress=20th+Congress&author_code=<lis_code>&page=<n>&per_page=100`

To refresh, open https://senate.gov.ph in a browser, run the fetches from the page's console one request at a time (~600 ms apart, with retries), and rebuild `data/bills.json`. Gotchas learned:

- Parse dates like `"August 25, 2026"` as strings. `new Date(...).toISOString()` shifts dates a day early in UTC+8 and puts bills in the wrong month.
- Some titles contain Cyrillic look-alike characters as HTML entities (`&#1057;`). Normalize to plain letters.
- A few senators have several `lis_code`s. Query each and de-duplicate by bill `id`.
- After rebuilding, check that each senator's per-month counts and per-status counts sum to `total`.
- Senator ids come from `officials.json` (`francis-pangilinan`, not `francis-kiko-pangilinan`). `validate.py` fails if `bills.json` or `laws.json` use an unknown id.
- Law roles: fetch `/lis/documents_v2?document_type=bills&congress=20th+Congress&status_code=<code>` for codes `6-200`, `6-210`, `6-220`, `6-320`, `4-590`; the `author`, `coAuthor`, `coSponsor` fields hold the roles.

## Before launch

- Get written permission or a data feed from the Senate (and House) ICT offices.
- Have a Philippine lawyer review the wording (cyber libel, RA 10173).
- The data source terms and robots rules could not be read (403), so confirm them with the Senate.

## Ideas, not built

House members, votes, SALN, COMELEC filings, a searchable full bill list, co-authored bills.
