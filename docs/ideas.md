# Ideas from readers

Suggestions from the first public post (BetterGov.PH Facebook group, November 24, 2026: 871 reactions,
33 comments, 454 shares), grouped by theme, with what the site already does and what each idea would take.
Commenters are not named here because this repo is public. Rule for everything below: show documented
facts with their source, never a score or a verdict we made up.

| # | Idea | Asked by | Today | Size |
|---|---|---|---|---|
| 1 | **Done Nov 25:** A list of every lawmaker with a case: who was charged, for what (plunder, graft), who was jailed | 3 readers | Each profile lists its cases; chamber pages filter by case status | Small |
| 2 | **Done Nov 25:** Compare bills and laws over the same period (by year or term) | 1 reader | Done on profiles (term filter, November 23). Rankings still count all of the 20th Congress | Small |
| 3 | SALN for House members, and the latest SALN | 2 readers | Senators only, from BetterGov's SALN Tracker | Depends on data |
| 4 | Look past counts: who led a bill (sponsor, committee chair, principal author) vs who only signed on | 1 reader (12 likes) | We count filed, passed, became law; House counts are principal author only | Medium |
| 5 | **Done Nov 25:** Separate national laws from local ones (renaming a road, creating a school) | 1 reader | Not done | Small to medium |
| 6 | Show what a law actually changed (systemic, an amendment, or symbolic) | 1 reader | Not done | Large; needs a stated method |
| 7 | Links to contractors, construction or mining firms | 1 reader | Not done; some cases on file already involve flood-control projects | Large; sensitive |
| 8 | **Started Nov 25 (guide page):** Easier for voters without much schooling: how to use this to choose | 1 reader | Filipino and English; plain language | Medium |
| 9 | A record at a glance: strong points and concerns | 1 reader | The summary card shows bills, laws and cases | Medium; risky if it turns into opinion |
| 10 | Candidates for the 2028 election, not only those in office | 1 reader | Lawmakers in office only | Large |

Not for this site: one reader asked to repeal old or useless laws. That is a matter for Congress, not something to
track here.

## Notes per idea

**1. Lawmakers with cases.** `data/cases.json` already has each case's `kind`, `title`, `role` and `status`
(pending, dismissed, convicted and so on). A "Cases" page could list everyone with a case, grouped by status and
filterable by charge words in the title (plunder, graft, malversation), each row linking to the profile. "Detained"
needs its own field, filled only from a court or jail record. Keep the line already on the site: a charge is not a
finding of guilt.

**2. Same period.** Add a term or year choice to the ranking bar, counting from `data/billhist/` (bills by Congress,
13th to 20th). Laws by year come from `data/laws.json`. Senators who served in different terms can then be compared
term by term.

**3. House SALN.** Check BetterGov's SALN Tracker for House members first. If it has none, House SALNs are released
on request through the House; note the date and source of each figure, as we do for senators.

**4. Role in a bill.** Possible sources: Senate bill pages (sponsor and committee), open-congress-data (authors,
committees), committee lists of both chambers (chairs and members). Show it as facts on each bill ("sponsored on the
floor", "chair of the committee that heard it", "co-author added on 2026-03-02"), not as points. BatasWatch has
principal authors only, so House co-authors need another source.

**5. National vs local laws.** Most local laws follow set title patterns: "renaming", "converting", "establishing a
... in the Municipality of", "separating", "increasing the bed capacity". Tag laws by title pattern, then check the
tags by hand, and let readers filter or count them apart. Publish the patterns so anyone can check the split.

**6. What a law changed.** Hard to do fairly. A defensible start is what the text says: whether it amends another
law (and which), creates an agency or a fund, or only renames or declares. Add analysis only when it comes from an
outside source we can cite (for example a think tank's review).

**7. Business links.** Only from official records: SALN "business interests and financial connections", SEC
filings, and DPWH or BetterGov contractor data where the lawmaker or close family is named. Each link must cite the
document; leave out anything that rests on surname alone. The highest bar of anything on the site, like court cases.

**8. Easier to use.** A short "How to use Sino Sila? to choose" guide in Filipino: three questions to ask about a
candidate and where to find each answer on the site. Also a one-screen summary per lawmaker in plain words, and
images people can share in group chats.

**9. Strong points and concerns.** Only as a sourced list of facts already on the profile (laws authored, cases,
SALN changes, attendance once we have it), with no labels like "good" or "bad". Otherwise it becomes our opinion.

**10. 2028 candidates.** After COMELEC publishes the list of candidates (around October 2027), add candidates with the
same profile layout. Election history comes from BetterGov Dynasties, as in the career section.

## Done on November 25, 2026

- **1:** `#mga-kaso` lists every lawmaker with a case, filtered by status and by kind (plunder, graft, malversation, flood control, libel, killings, election, administrative). Detention is not tracked.
- **2:** The ranking bar has a term choice (13th to 20th Congress), from `data/billterms.json`.
- **5:** Every law carries a tag (national, local, franchise, commemorative day, and "amends a law"), sorted by title words, with counts on each profile. The start of 6 too: whether a law amends another.
- **8:** `#gabay`, a five-step guide with questions to ask a candidate.
- `#bago`, a What's new page, lists these changes and what is not done yet, with the reason.
- **3** is blocked: BetterGov's SALN Tracker covers only senators, the President and the Vice President.

## Suggested order

1, 2 and 5 are small and use data we already have. 3 depends on what BetterGov's SALN Tracker covers. 4 and 8 are the
most asked-about improvements in quality. 6, 7, 9 and 10 need a written method first.
