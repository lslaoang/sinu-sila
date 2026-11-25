# Data and image licensing

The **code** is MIT-licensed (see [LICENSE](LICENSE)). The **data** and **images** come from many public sources, so
each part keeps the terms of where it came from. If you reuse something, credit Sino Sila? (https://sinu-sila.com)
and the original source named below. Every record in the data files also carries its own source link.

| Path | What it is | Licence | Credit |
|---|---|---|---|
| `data/officials.json`, `data/bills.json`, `data/laws.json` | Senators, their bills and enacted laws | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) for our compilation | Senate of the Philippines, Legislative Information System. Philippine government works are not subject to copyright (RA 8293, sec. 176), but the Senate's permission may be needed for commercial use. |
| `data/education.json` | Where senators studied | CC BY 4.0 for our compilation | The source linked on each item |
| `data/cases.json` | Court and administrative cases | CC BY 4.0 for our compilation | The news outlets and court or Ombudsman pages linked on each event. Read the rules in [docs/data.md](docs/data.md#court-cases) before reusing: a listed case is an allegation unless a court decided it. |
| `data/house.json` | House of Representatives roster | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (it is derived from Wikipedia) | Wikipedia, *List of current members of the House of Representatives of the Philippines* (the exact revision is in the file) |
| `data/saln.json` | Senators' declared assets, liabilities and net worth | MIT (see notice below) | [BetterGov.ph SALN Tracker](https://github.com/bettergovph/saln-tracker-ph), and the source linked on each figure |
| `data/elections.json`, `data/local/*.json` | Election results and local officials | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [BetterGov.ph Dynasties](https://dynasties.bettergov.ph/developers), built from [Open Halalan](https://robertrleung.github.io/OpenHalalan/) (Leung, Robert R.). Please cite Open Halalan for election results. |
| `data/district_places.json` | Towns or barangays per House district | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (derived from Wikipedia) | Wikipedia, the article of each district (linked in the file) |
| `data/career.json` | Races since 2001 and terms in Congress | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [BetterGov Dynasties](https://dynasties.bettergov.ph), built from [Open Halalan](https://robertrleung.github.io/OpenHalalan/) (Leung, Robert R.; please cite it for election results); [BetterGov open-congress-data](https://github.com/bettergovph/open-congress-data) |
| `data/billhist/*.json`, `data/bill_pairs.json` | Each lawmaker's bills in every term, with the other chamber's version | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [BetterGov open-congress-data](https://github.com/bettergovph/open-congress-data) (13th-19th Congress), Senate of the Philippines and [BatasWatch](https://bills.juris.ph) (20th) |
| `data/house_bills*.json` | House members' bill counts and titles | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (BatasWatch); official records from congress.gov.ph | [BatasWatch](https://bills.juris.ph) |
| `data/contacts.json` | Office contact details | Published by the Senate and the House of Representatives; official office channels only | [senate.gov.ph](https://senate.gov.ph/senators), [congress.gov.ph](https://www.congress.gov.ph/house-members) |
| `data/facts.json` | Date and place of birth | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Wikidata](https://www.wikidata.org) |
| `data/budget.json` | DPWH budget per House district (NEP, House bill, GAA) | Government budget documents are public works; the compilation is BetterGov's (API code MIT; attribution requested) | [BetterGov Budget](https://budget.bettergov.ph), with a link to BetterGov's page on every district and project |
| `data/pulitiklan.json` | Links to Pulitiklan family pages | URLs only, no Pulitiklan data is copied | [Pulitiklan](https://pulitiklan.com) |
| `assets/photos/*.webp` | Portraits, resized and with the background removed (a modification of the original) | Each file's own licence on Wikimedia Commons (mostly public domain, CC0 or CC BY-SA); our edits are offered under the same licence as the original | The Commons file page linked on each profile (`photo_credit_url` in the data) |
| `assets/schools/*.png` | School seals | **Not licensed for reuse.** Trademarks of their institutions, shown only to identify a school | The institution |
| `assets/og.png` | Link-preview image | CC BY 4.0 | Sino Sila? |

## Notice for `data/saln.json`

Derived from the BetterGov.ph SALN Tracker, which is distributed under this licence:

```
MIT License

Copyright (c) 2024 Netlify

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## No warranty

The data is compiled with care from public sources but may contain errors or be out of date. It is provided as is.
Report mistakes through the site's "Report an error" button or a GitHub issue.
