# Report cards ("Marka") on Sino Sila? — plan

Status: **staging only** (https://sinu-sila.com/staging/index.html, not indexed, not linked from the live site).
Branch: `report-cards` (worktree `~/dev/ph-politicians-staging`). Nothing here is on the live site until Laurel approves.

Inspired by the GovGrade PH proposal: a report card per official, computed from public records with a published
formula, on the DepEd scale where 75 is passing. This plan keeps that idea and adapts it to Sino Sila?'s rules
(every fact sourced, a charge is not a verdict, nothing presented as a clean record when it is only unchecked).

## 0. Data sources: BetterGov.ph first

Every indicator is fed from BetterGov.ph's open data where BetterGov has it, and from the official source only where
it doesn't. BetterGov already cleans and links these records, credits its upstream sources and publishes under open
licences, so we build on it instead of re-scraping, and credit it on every card.

| Need | BetterGov source (first) | Fallback / where BetterGov has nothing yet |
|---|---|---|
| Senators' SALN | SALN Tracker (MIT), in use: `saln.json` | Senate SALN releases |
| Election results, rosters (national and local, 2001–2025) | Dynasties API (CC0, from Open Halalan), in use: `elections.json`, `data/local/*.json` | COMELEC |
| LGU budgets / investment programs | Naga AIP dashboard, Budget portal (budget.bettergov.ph, CC0), transparency-portal (MIT) | DBM, LGU websites |
| Procurement contracts | Transparency Dashboard (transparency.bettergov.ph, PhilGEPS records) | PhilGEPS |
| Infrastructure projects | Flood-control / DPWH viewers (MIT) | DPWH |
| Bills, laws | (BetterGov's Congress dataset stops at 2019) | Senate LIS, weekly agent |
| Attendance, audit opinions, FDP compliance | none yet | Senate journals, COA, DILG |

## 1. What we keep from GovGrade

- **Three layers, kept apart.** Layer 1 = the records we already publish, each with a source link. Layer 2 = a grade
  computed only from Layer 1 by a published formula, the same for everyone. Layer 3 (later) = citizen ratings, shown
  separately and never added to the grade.
- **DepEd scale and bands**: below 75 *Did not meet expectations*, 75–79 *Fairly satisfactory*, 80–84 *Satisfactory*,
  85–89 *Very satisfactory*, 90–100 *Outstanding*. Filipinos already know how to read it.
- **Peer groups**: senators are compared with senators only; House members with House members; later, mayors with
  mayors of the same LGU type and income class.
- **Top-5 benchmark**: a target is the average of the top 5 in the peer group, so the bar comes from what peers
  actually do, not from a number we pick.
- **70% rule**: no overall grade until at least 70% of the indicator weight has verified data. Below that, the card
  shows the indicators it has and says "Grade withheld: not enough verified data".
- **Voters can change the weights** (sliders), the formula is in the open, and officials can reply to any data point
  (our existing "Report an error" form, relabelled "Are you this official? Submit a correction").

## 2. What we change, and why

| GovGrade idea | Our version | Why |
|---|---|---|
| Education bonus up to +5 | **Dropped.** Schooling stays a fact on the profile. | The Constitution sets literacy, not a degree, as the qualification. A degree bonus grades privilege, not performance. |
| Dynasty penalty −10 | **Dropped from the grade.** The political-family link stays a fact on the profile. | Surname matches are not proven family ties, and a penalty on relatives is a judgement about voters' choices, not the official's work. |
| Court cases | **Never in the grade.** Shown beside it, as now. | Presumption of innocence: a pending case can't lower a grade. |
| Campaign promises kept (30%) | **Later phase**, only with a public promise tracker where each promise and its status has two sources. | Hard to verify fairly; needs volunteers and a review queue first. |
| Grade shown as one number | Number **plus the completeness bar and the per-indicator breakdown, always together**. | A grade without its inputs invites misreading. |
| Report-card look | A printed **DepEd Form 138-style table**: Indicator · Grade · Remarks, in the site's almanac style. | Familiar, readable, and fits the existing design. |

## 3. Phase A (this staging build): senators, method v0.1

Data we already have, refreshed weekly by the agent:

| Indicator | Default weight | Score | Source |
|---|---|---|---|
| Bills authored | 25 | 60 + 40 × min(1, bills ÷ top-5 average) | Senate LIS (`bills.json`) |
| Laws backed | 25 | 60 + 40 × min(1, laws ÷ top-5 average) (author, co-author or co-sponsor of an enacted bill) | Senate LIS (`laws.json`) |
| SALN disclosure | 25 | 100 = latest-cycle SALN public with a source; 80 = only an older one; no score if we have none on file | BetterGov SALN Tracker (`saln.json`) |
| Session attendance | 25 | not collected yet, so no score; it counts against completeness | Senate journals (to do) |

- The 60 floor mirrors DepEd's transmutation table, where a raw zero becomes 60.
- Overall = weighted average of the indicators that have data, shown only if their weight is at least 70% of the total.
  With attendance missing, completeness is 75%, so senators get a grade; Raffy Tulfo (no SALN on file) is at 50%: withheld.
- Known limits, printed on the methodology page: counting bills rewards volume, not quality; the 20th Congress started
  in July 2025, so laws are few; the Senate President and floor leaders file fewer bills by role; SALN disclosure is
  near-universal this cycle, so it barely separates senators.

## 4. Pages in staging

- **Report cards** (`#marka`): every senator ranked by grade, with band, completeness and the four indicators;
  a "Your weights" panel (sliders, reset) that re-ranks live; plain-language note that the grade leaves out cases,
  schooling and family.
- **Profile**: a report-card block under the summary (big grade box, Form 138 table with each indicator's value and
  source link, completeness bar, correction link).
- **Methodology** (`#paraan`): formula, weights, benchmarks, bands, exclusions and why, data sources, limits, version.
- The staging copy carries a "Staging preview" banner and `noindex`.

## 5. Later phases (not built)

- **B. House members**: collect House bills and attendance (congress.gov.ph sits behind a bot check, so through the
  browser like the Senate). Same scorecard, House peer group.
- **C. Attendance and committee work** for senators from Senate journals; brings completeness to 100%.
- **D. Local pilot (started in staging)**: Naga City's 2025 officials (mayor, vice mayor, 8 councilors) come from
  BetterGov Dynasties via `python3 tools/import_local.py camarines-sur naga "Naga City"`; the city transparency checklist
  (GovGrade's executive scorecard, 100 points) lists BetterGov evidence first. Today only the AIP 2026 item has evidence,
  and only partial, so every grade is withheld under the 70% rule: the page doubles as the volunteers' to-do list.
  Then: one city end to end (governor to kagawad), as GovGrade suggests. Naga is a strong candidate:
  BetterGov already publishes its AIP dashboard, and DILG Full Disclosure, COA audit opinions and BLGF revenue are public.
  Roster and 2025 results from the BetterGov Dynasties API (PSGC-keyed). Executive scorecard: transparency (budget,
  spending, contracts, project tracker, COA match, SALN, FDP/FOI), results vs peer LGUs, core duties.
- **E. Map**: PSGC boundaries (already used by Dynasties) shaded by average grade, once enough LGUs have grades.
- **F. Citizen pulse**: verified-resident ratings, separate from the grade, with moderation. Needs accounts; last.

## 6. Before any of this goes live

- Lawyer review of the method and wording (cyber libel, RA 10173). A grade is an opinion; it must read as one,
  built from facts that are not.
- A right-of-reply flow: officials' corrections answered and logged publicly.
- Method versioning: every grade carries its method version; changes are logged.
