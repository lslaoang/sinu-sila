# Weekly update runbook (for the scheduled agent)

Runs every Monday 6:00 AM (Asia/Manila) as the scheduled task `sinosila-weekly-update`.
Repo: `~/dev/ph-politicians`. Live site: https://sinu-sila.com. AWS: use the maintainer's deploy profile (the scheduled task exports `AWS_PROFILE`).

**Publishing rule (decided by the maintainer, 2026-11-13):** Senate bills, laws and the House roster go live
automatically once every check below passes. **Court cases are never published by this agent.** Case findings go
to `review/` (git-ignored) for the maintainer to check against the sources first. When in doubt, hold a file back
and say why in the report; a stale page is better than a wrong one.

## 0. Start clean
- `cd ~/dev/ph-politicians && git status --short`. If anything other than `review/` is uncommitted, stop and report
  (someone is mid-edit). Never stash, reset or discard their work.
- `git pull --ff-only` only if a remote is configured and it succeeds cleanly; otherwise carry on with local main.

## 1. Senate bills and laws (built-in browser first, Chrome as fallback)
senate.gov.ph sits behind a Cloudflare bot check: plain scripts and headless browsers get "Attention Required".
Never try to get around it. The data is read from inside a real browser tab, which loads the site normally.

**A. Built-in browser (preferred: the Claude app's own browser pane, tools named `mcp__Claude_Browser__*`)**
1. `python3 tools/apply_senate.py --print-js > /tmp/sinosila-snippet.js` and read that file.
2. Open https://senate.gov.ph/legislative-documents/bills with `preview_start` (`url`), then run the snippet's full
   text with `javascript_tool`. It returns `started` right away.
3. Poll `window.__ss.status` (wait about 30 s per call, the tool times out at 45 s) until it starts with `done:`
   (about 2 min) or `error:`. Ignore the yellow copy button; its clipboard is blocked in this browser.
4. `python3 tools/apply_senate.py --print-diff-js > /tmp/sinosila-diff.js`, read it, and run its full text in the same
   tab. It returns JSON with only the senators whose data changed (`changed_ids`, `entries`), plus `laws_raw` if the
   laws changed. If `pages` is more than 1, also run `--print-diff-js --page 1`, `--page 2`, ... in the same tab.
5. Save each reply **exactly as returned** to `/tmp/sinosila-p0.json`, `/tmp/sinosila-p1.json`, ... (Write tool).
   Every entry carries a SHA-256 hash, so a copying slip is caught in the next step instead of reaching the site.
6. `python3 tools/apply_senate.py --patch /tmp/sinosila-p*.json`.
   - "hash mismatch": re-copy that page's reply exactly and run again. Never edit an entry to make it pass.
   - Exit 2 = the data looks broken (a senator with no bills, a big drop). Do **not** use `--force`.
     Restore `git checkout data/bills.json data/laws.json` if touched, go on to section 2, and report it.
   - "NAME NOT MATCHED" lines are usually House members or former senators: just list them in the report.
   - "no changes since the last refresh" is normal; the files still get today's date.
7. Delete the `/tmp/sinosila-*` files.

**B. Fallback: Claude in Chrome** (only if the built-in browser is unavailable). Chrome's script results are cut at
about 1,000 characters, so use the copy button instead of steps 4–6:
1. Run the `--print-js` snippet in a senate.gov.ph tab in Chrome and poll `window.__ss.status` as above.
2. Save the clipboard (`pbpaste > /tmp/sinosila-clip-backup.txt`), take a screenshot and left-click the yellow
   **Copy Sino Sila data** button with the computer tool (a real click; script clicks are refused).
3. `python3 tools/apply_senate.py --clipboard`, then restore the clipboard
   (`pbcopy < /tmp/sinosila-clip-backup.txt && rm /tmp/sinosila-clip-backup.txt`). Same exit-code rules as above.
4. Close the tab.

If neither browser can open the site, skip this step and say so in the report.

## 2. House roster (Wikipedia, plain script)
1. `python3 tools/import_house.py` prints ADDED / REMOVED / CHANGED lines.
2. `python3 tools/mirror_photos.py` (re-points photos to `assets/photos/*.webp`, downloads any new member's photo and
   removes its background so it matches the others; a `skip` line means that photo kept its original background, so list it).
3. Hold the roster back (`git checkout data/house.json data/officials.json assets/photos`) if:
   - more than 15 ADDED/REMOVED lines in one week (probably a page restructure, not real change), or
   - a REMOVED id has entries in `data/cases.json` or `data/pulitiklan.json` (they would be orphaned), or
   - the member count is outside 300–330.
   Party and bloc CHANGED lines are normal (members switch parties); list them in the report.

## 2b. SALN totals
`python3 tools/import_saln.py` re-reads BetterGov's SALN Tracker. Publish `data/saln.json` if it changed and
`validate.py` passes. Hold it back (`git checkout data/saln.json`) if a senator who had records now has none, or if
more than 3 new PROBLEM lines appear; list PROBLEM lines in the report either way. (Election results in
`data/elections.json` change only after an election: don't re-run that tool weekly.)

## 2a. Bill history in every term (monthly, not weekly)
Past Congresses do not change, so `data/billhist/` and `data/bill_pairs.json` only need a refresh about once a month for
the current Congress. Clone (or `git pull`) https://github.com/bettergovph/open-congress-data, run
`python3 tools/import_bill_history.py --print-js` in a senate.gov.ph tab (20th Congress only, about 10 minutes; it paces
itself and backs off on HTTP 429), save the file with its button, then
`python3 tools/import_bill_history.py --ocd <clone> --senate20 <file>`. It refuses to write if a senator with bills
has no 20th Congress rows. Skip it in the weekly run unless the maintainer asks.

## 2c. Career in office (after an election, not weekly)
Races only change after an election. Then run `python3 tools/import_career.py --ocd <open-congress-data clone> --fresh`
(about 10 minutes) and read `review/career_review.txt`: confirm each new SENATOR and PARTY-LIST line by hand (add
senators' records to `SEN_LOCAL`, approved party-list ids to `PL_OK`, wrong matches to `REJECT`), then publish
`data/career.json` if `validate.py` passes. Skip it in the weekly run.

## 2b2. House bills (BatasWatch)
`python3 tools/import_house_bills.py` re-reads BatasWatch (bills.juris.ph, CC0) and writes `data/house_bills.json` (counts)
and `data/house_bills_detail.json` (titles). It refuses to write if fewer than 280 members match. Publish both if they
changed and `validate.py` passes. List "NOT MATCHED" lines in the report (usually members who left or joined).

## 2c. District budget (DPWH)
`python3 tools/import_budget.py` re-reads BetterGov's budget API (about 5 minutes). It refuses to write if fewer than
240 districts match. Publish `data/budget.json` if it changed and `validate.py` passes. "CHECK name" lines are usually
spelling differences (suffixes, hyphens); list any that look like a different person, and hold the file back
(`git checkout data/budget.json`) if more than 5 do. When BetterGov adds the enacted FY2027 GAA, say so in the report:
the page needs a GAA column, which is a code change for the maintainer.

## 3. Court cases: research only, never publish
For up to 10 cases in `data/cases.json` whose latest event is the oldest among those with status
`filed` / `pending` / `appealed` / `suspended`, search the news and court sites for anything newer.
Write findings to `review/weekly-<date>.md`: person, case, what changed, at least two independent source URLs
(or one official court/Ombudsman page). Neutral wording only (see README, "Court cases and proceedings").
Do **not** edit `data/cases.json`.

## 4. Check
- `python3 validate.py` must pass. If it fails, restore the files you changed this run and report.
- Spot-check: `python3 -m json.tool data/bills.json >/dev/null` (same for laws, house).

## 5. Publish (only the files that changed)
```bash
B=s3://sino-sila-773994910221
git status --short data assets            # see what changed
aws s3 cp data/<file>.json $B/data/<file>.json --content-type application/json --cache-control "public, max-age=300"   # each changed data file (incl. budget.json)
aws s3 sync assets/photos $B/assets/photos --size-only --content-type image/webp --cache-control "public, max-age=86400"   # if photos changed
aws cloudfront create-invalidation --distribution-id E1QGRO3D7NQZVA --paths "/data/*" "/assets/photos/*"
```
Wait for the invalidation (`aws cloudfront wait invalidation-completed ...`), then confirm the live copy:
`curl -s https://sinu-sila.com/data/bills.json | python3 -c "import json,sys;print(json.load(sys.stdin)['_meta']['retrieved'])"`
shows today's date (when bills changed), and https://sinu-sila.com/#senado loads in Chrome with 24 cards.
Never upload `review/`, `tools/` or anything outside `data/` and `assets/photos/` (never `data/cases.json`). Never change `index.html`.

## 6. Commit
`git add data assets/photos && git commit -m "DATA: Weekly refresh <date>"` with a short body listing what changed.
No `Co-Authored-By` trailer. Do not push.

## 7. Report
Finish with a short summary (this is what the maintainer reads):
- **Published:** bill count changes, new laws, House roster changes, or "no changes".
- **Held back:** anything not published and why.
- **Needs you:** case leads in `review/weekly-<date>.md` (count), names not matched, anything that failed.
Then send it as a push notification if that tool is available.
