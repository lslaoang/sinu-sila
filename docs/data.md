# Data: sources, methods and rules

Sino Sila? has one rule: **no record without a source link.** `python3 validate.py` enforces it before anything is
published. This page explains where each file comes from, how it is built, and its known gaps.
Licensing is in [DATA_LICENSE.md](../DATA_LICENSE.md).

## Files at a glance

| File | Contents | Source | Built by |
|---|---|---|---|
| `data/officials.json` | The 24 senators of the 20th Congress: name, position, Senate LIS codes, membership records | [Senate of the Philippines](https://senate.gov.ph/senators/20-congress-senators) | hand-built, refreshed by the weekly agent |
| `data/bills.json` | Per senator: total bills authored, count per month, count per status, 5 latest | [Senate Legislative Information System](https://senate.gov.ph/legislative-documents/bills) | `tools/senate_fetch.js` + `tools/apply_senate.py` |
| `data/laws.json` | Enacted bills (approved, lapsed into law, consolidated) and enrolled bills, with each senator's role | Senate LIS, filtered by status | same |
| `data/education.json` | Schools, degrees and years; every item has its own source | Senate profiles, Wikipedia, cross-checked (below) | hand-built |
| `data/house.json` | 317 House members (253 district, 64 party-list) and vacancies; party, bloc, leadership role, Commons photo | Wikipedia list of current members (exact revision cited) | `tools/import_house.py` |
| `data/cases.json` | Court, Ombudsman and election cases, as timelines of sourced events | News outlets and court/Ombudsman pages | research + `tools/ingest_cases.py` |
| `data/saln.json` | Senators' declared assets, liabilities and net worth | [BetterGov.ph SALN Tracker](https://github.com/bettergovph/saln-tracker-ph) | `tools/import_saln.py` |
| `data/elections.json` | The race that put each lawmaker in office | [BetterGov.ph Dynasties](https://dynasties.bettergov.ph/developers), from [Open Halalan](https://robertrleung.github.io/OpenHalalan/) | `tools/import_elections.py` |
| `data/pulitiklan.json` | Links to political-family pages | [Pulitiklan](https://pulitiklan.com) (links only) | `tools/link_pulitiklan.py` |
| `assets/photos/*.webp` | 341 portraits | Wikimedia Commons | `tools/mirror_photos.py` |

**BetterGov.ph first.** Where [BetterGov.ph](https://bettergov.ph) already publishes clean, open data, we use it instead
of re-scraping, and credit it (and its upstream sources) on every profile.

## Senate bills and laws

- **Bills authored** counts bills where the Senate lists the senator as author.
- **Laws backed** counts enacted bills (approved by the President, lapsed into law, or consolidated with one) where the
  senator is author, co-author or co-sponsor; profiles show which role. Enrolled bills awaiting signature are listed but
  not counted as laws. A Senate bill folded into another bill is not detected unless the Senate marks it so.
- The Senate's own per-senator counters (`bills_passed_into_law`, `authored_bills`) are stale, so they are not used.
- senate.gov.ph blocks plain scripts (HTTP 403) but serves its pages' JSON to a browser, so the data is read from inside
  a browser tab. See [operations.md](operations.md#refreshing-senate-data) for the procedure and its pitfalls.

## Education

Only what the cited sources state, and each item can list several sources. Twelve senators' entries come from their
Senate profile biography. The other twelve, whose Senate biographies omit schooling, were taken from Wikipedia and then
cross-checked (2026-10-01) against GMA candidate profiles, UP sa Halalan, news and fact-check outlets and the senators'
own sites. Unsupported claims were dropped, and where sources disagree the entry says so. Contested items are shown with
institutional statements and a neutral note. Items flagged `"match": false` (disputed, unconfirmed or single-source)
are skipped by the "where they studied" filter.

## House of Representatives

A first-pass roster from Wikipedia, citing the exact revision used. A stratified sample of 32 members was checked
against non-Wikipedia sources on 2026-10-02 (details in `data/house.json` → `_meta.audit`): seats held up; party labels
change during a term (2026 saw several switches); Wikipedia's "took office" dates were unreliable, so records use the
start of the 20th Congress; leadership roles may be incomplete. The weekly agent re-imports the roster and reports
additions, removals and party changes. congress.gov.ph sits behind a bot check, so it is not used yet.

## SALN (asset declarations)

From the BetterGov SALN Tracker. Every figure keeps its own source link (Senate SALN pages, ABS-CBN, Rappler, PCIJ).
The tracker's "year" labels are inconsistent (the same October 2025 release is labelled 2024 for some senators and 2025
for others), so profiles show dates instead: "as of Dec 31, YYYY" or "reported on <date>". Records whose year and date
contradict each other are dropped rather than guessed. Figures are as declared by the official, not audited, and
profiles say so.

## Election results

From BetterGov's Dynasties API (CC0), which is built from Open Halalan; profiles credit both.

- Senators: rank and votes in the 2025 or 2022 race (24 of 24).
- District representatives: 2025 votes, vote share, margin and runner-up (246 of 253). Members are matched to races,
  not to BetterGov's person records (which split some people). A winner is accepted only when the surname plus a given
  name or nickname matches within the same province or city, or when the seat matches plus a shared surname or given
  name (ballot nicknames such as "ABET" for Albert). Multi-seat races show rank only. Unmatched seats say
  "no matching result" instead of guessing.
- Party-list groups: 2025 national votes and rank (56 of 57).

Election results change once per election, so `tools/import_elections.py` is re-run only after one.

## Court cases

`data/cases.json` publishes real people's legal history, so the rules are strict:

- Each case is a timeline of events, each with its own source links. A case needs **two independent outlets or one
  official court or Ombudsman page** (`validate.py` enforces this). Single-outlet leads go to the git-ignored `review/`
  folder and are never published.
- Wording is neutral. Charges are "alleged"; guilt is stated only where a court or the Ombudsman decided. Dismissals,
  acquittals, appeals and the person's own response are recorded alongside charges. A preventive suspension is not a
  finding of guilt.
- "No court cases found in the sources checked on <date>" appears only for people actually checked
  (`_meta.checked`); everyone else is "not yet checked". An absence of results is never presented as a clean record.
- Private family or business disputes are out of scope unless they became a public-office matter.
- Every published case's sources were opened and read by a person, not just taken from a research summary.

Coverage on 2026-11-13: 128 cases across 105 lawmakers; 307 people checked, 34 not yet checked.

Workflow: researchers return strict JSON per person; `python3 tools/ingest_cases.py report.json` validates and merges
it; each new case is spot-checked against its sources before it is committed. The weekly agent only *researches* case
updates into `review/`; it never publishes them.

## Political families

Pulitiklan maps relatives by place. It has no stated reuse terms, so none of its data is copied:
`tools/link_pulitiklan.py` matches people to Pulitiklan's published family-page URLs by surname and place, keeps a link
only if the person's name appears on that page, and stores URLs only. Profiles show it as a labelled link-out.

## Portraits and school seals

- Portraits are small WebP copies of Wikimedia Commons files, so pages don't depend on other sites. Each profile links
  to its Commons file page, which states the author and licence.
- School seals (`assets/schools/`) are shown only to identify a school and belong to their institutions; several are
  non-free logos on Wikipedia. Get permission or use files the schools provide before any wider reuse.

## Known gaps

- House members: no bills, laws or education yet (congress.gov.ph blocks scripts).
- No roll-call votes, attendance or committee work yet.
- Case statuses go stale; corrections and right of reply run through the "Report an error" form.
- A Philippine lawyer's review of the wording (cyber libel, RA 10173) is still to do.
