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
| `photo` in `officials.json` | Senator photo URL on senate.gov.ph | `/hq/senators/congress/28` (`image_upload.file_url`) |

"Bills authored" counts bills where the Senate lists the senator as author. "Laws backed" counts enacted bills (approved by the President, lapsed into law, or consolidated with a law) where the senator is author, co-author or co-sponsor, and the profile shows which role. A Senate bill folded into another bill is not detected unless the Senate marks it so. The Senate's own per-senator stats (`bills_passed_into_law`, `authored_bills`) are stale (all zero for laws), so they are not used.

**Education** only records what the cited sources state, and each item can list several source links. Twelve senators' entries come from their Senate profile bio (not independently cross-checked). The other twelve, whose Senate bios omit schooling, were first taken from Wikipedia and then cross-checked on 2026-10-01 against GMA candidate profiles, UP sa Halalan, news and fact-check outlets and the senators' own sites. Unsupported claims were dropped (e.g. Legarda's UCLA courses, Marcoleta's "cum laude" and "certificate"), and where sources disagree the entry says so (e.g. Bong Go's college, Marcoleta's doctorate year). Some official pages (Senate bios, Inquirer, Rappler) returned 403 to the checking tool, so a human check against those and against university records is still worth doing before launch. Contested items (Imee Marcos) are shown with institutional statements and a neutral note, without editorial wording.

**Homepage interactions** (seating chart sized by bills or laws, "where they studied" highlight) are computed in the browser from the data files. The school filter counts any non-honorary item whose school matches (Ateneo, UP, La Salle, UST, Harvard, UE, PMA, Georgetown) and skips items flagged `"match": false` in `education.json` (disputed, unconfirmed or single-source).

**Photos** are hotlinked from senate.gov.ph in the visitor's browser (scripts get HTTP 403, so they are not downloaded or stored here). If an image fails, the initials avatar stays. Confirm reuse terms with the Senate.

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
