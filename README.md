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

"Authored" means the Senate lists the senator as the bill's author. Co-authored bills are not counted. "Signed into law" means the Senate's status is "Approved by the President", not cross-checked against Republic Act records.

## Refreshing the data (manual)

The Senate site blocks plain scripts (HTTP 403) but loads normally in a browser. Its pages read JSON from:

- Senators: `/hq/senators/congress/28?per_page=100`
- Bills: `/lis/documents_v2?document_type=bills&congress=20th+Congress&author_code=<lis_code>&page=<n>&per_page=100`

To refresh, open https://senate.gov.ph in a browser, run the fetches from the page's console one request at a time (~600 ms apart, with retries), and rebuild `data/bills.json`. Gotchas learned:

- Parse dates like `"August 25, 2026"` as strings. `new Date(...).toISOString()` shifts dates a day early in UTC+8 and puts bills in the wrong month.
- Some titles contain Cyrillic look-alike characters as HTML entities (`&#1057;`). Normalize to plain letters.
- A few senators have several `lis_code`s. Query each and de-duplicate by bill `id`.
- After rebuilding, check that each senator's per-month counts and per-status counts sum to `total`.

## Before launch

- Get written permission or a data feed from the Senate (and House) ICT offices.
- Have a Philippine lawyer review the wording (cyber libel, RA 10173).
- The data source terms and robots rules could not be read (403), so confirm them with the Senate.

## Ideas, not built

House members, votes, SALN, COMELEC filings, a searchable full bill list, co-authored bills.
