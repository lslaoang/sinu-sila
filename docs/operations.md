# Operations: hosting, deploys and automation

For maintainers. Everything runs on AWS; there is no build step.

## Hosting

| Piece | Where |
|---|---|
| Site files | S3 bucket `sino-sila-773994910221` (ap-southeast-1), private, served through CloudFront |
| CDN | CloudFront distribution `E1QGRO3D7NQZVA` (https://sinu-sila.com, www, and d3kbf1pju0ogt8.cloudfront.net) |
| Domain | `sinu-sila.com`, DNS in Route 53, HTTPS certificate in ACM (us-east-1) |
| "Report an error" form | Lambda `sino-sila-report` (ap-southeast-1), emails reports through SES; code in `tools/contact_lambda/`, setup in `tools/create_contact_form.sh` |
| Visit counter | Lambda `sinosila-stats` + DynamoDB `sinosila-stats` (ap-southeast-1), behind CloudFront `/e` and `/e/*`; code in `tools/stats_lambda/` |
| Staging | `https://sinu-sila.com/staging/index.html` (S3 prefix `staging/`, `noindex`, banner shown) |

## Deploying a change

```bash
export AWS_PROFILE=<your deploy profile>
python3 validate.py                                           # must print "ok"
aws s3 cp index.html s3://sino-sila-773994910221/index.html --content-type "text/html; charset=utf-8"
aws s3 cp data/<file>.json s3://sino-sila-773994910221/data/<file>.json --content-type application/json
aws cloudfront create-invalidation --distribution-id E1QGRO3D7NQZVA --paths /index.html / "/data/*"
```

Staging: copy `index.html` to `s3://…/staging/index.html` with a `<meta name="robots" content="noindex,nofollow">`
added, sync `data/` and `assets/` under `staging/`, and invalidate `/staging/*`.

## Weekly update agent

A scheduled Claude task (`sinosila-weekly-update`, Mondays 6:00 AM Manila time, runs while the Claude desktop app is
open) follows [`tools/weekly_update.md`](../tools/weekly_update.md):

1. Senate bills and laws through a browser tab (`tools/senate_fetch.js` → `tools/apply_senate.py --clipboard`).
2. House roster (`tools/import_house.py` prints ADDED / REMOVED / CHANGED) and photos (`tools/mirror_photos.py`).
3. SALN totals (`tools/import_saln.py`).
4. Court cases: research only, into `review/`, never published by the agent.
5. `validate.py`, publish only the data files that changed, commit `DATA: Weekly refresh <date>`.

It holds a file back instead of publishing when something looks wrong (a big drop in bills, many roster changes, a
senator losing SALN records, a failed check) and says why in its report. It stops if the working tree is not clean.

## Refreshing Senate data

senate.gov.ph blocks plain scripts (HTTP 403) but loads in a browser, and its pages read JSON from:

- Senators: `/hq/senators/congress/28?per_page=100`
- Bills by author: `/lis/documents_v2?document_type=bills&congress=20th+Congress&author_code=<lis_code>&page=<n>&per_page=100`
- Laws by status: same endpoint with `status_code=` `6-200`, `6-210`, `6-220`, `6-320`, `4-590`; the `author`,
  `coAuthor`, `coSponsor` fields hold the roles as "SURNAME, GIVEN" lists

`python3 tools/apply_senate.py --print-js` prints a snippet to run in a senate.gov.ph tab. It fetches everything about
600 ms apart with retries and then shows a "Copy Sino Sila data" button; a real click copies the data (Chrome blocks
repeated automatic downloads, and browser-automation tools truncate long results). `python3 tools/apply_senate.py --clipboard`
then rebuilds `bills.json` and `laws.json`. It refuses to write if a senator has no bills, a total drops by more than 5,
or fewer laws come back than before. Pitfalls it already handles:

- Dates like `"August 25, 2026"` are parsed as strings (converting through UTC shifts them a day in UTC+8).
- Some titles use Cyrillic look-alike letters as HTML entities; they are normalised to Latin.
- Senators with several LIS codes are queried per code and de-duplicated by bill id.
- Name suffixes ("SOTTO III, VICENTE C.") are stripped before matching names to senator ids.

## Visit counter

Privacy-first: no cookies, no IP addresses, no visitor IDs, only daily totals. `index.html` sends one beacon per page
to `/e` (only on sinu-sila.com, never on localhost or staging). The Lambda adds 1 to that day's counters (Manila time):
views, visits (first page of a browser-tab session), page, referrer site, country (CloudFront's
`CloudFront-Viewer-Country`), device and language. Bots and link-preview crawlers are skipped.

The dashboard is `https://sinu-sila.com/stats.html` (unlisted, `noindex`). It reads `/e/stats` with a key sent in the
`x-stats-key` header. The key is the Lambda's `STATS_KEY` setting and is kept locally in the git-ignored
`tools/.stats_key`; never commit it.

## Secrets and private files

Never committed: `tools/.stats_key`, `review/` (unpublished research), AWS credentials. The report form's destination
address lives only in the `sino-sila-report` Lambda's settings.
