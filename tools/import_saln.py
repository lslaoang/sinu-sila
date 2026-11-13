"""Import senators' SALN (Statement of Assets, Liabilities and Net Worth) totals into data/saln.json.

Run: python3 tools/import_saln.py   (stdlib only, 2 requests)
Source: BetterGov.ph SALN Tracker, https://github.com/bettergovph/saln-tracker-ph (MIT licence), which compiles the
totals from the Senate's SALN releases and news reports. Every record keeps its own source link; records without
one are dropped. Figures are as declared by the official: nobody has audited them.
"""
import json, re, sys, unicodedata, urllib.request
from datetime import date

REPO = "https://raw.githubusercontent.com/bettergovph/saln-tracker-ph/main/"
UA = {"User-Agent": "sinosila/1.0 (+https://sinu-sila.com)"}


def get(path):
    with urllib.request.urlopen(urllib.request.Request(REPO + path, headers=UA), timeout=60) as r:
        return r.read().decode()


def toks(s):
    s = unicodedata.normalize("NFKD", re.sub(r"[‐-―-]", " ", s)).encode("ascii", "ignore").decode().upper()
    return [w for w in re.sub(r"[^A-Z ]", " ", s).split() if w not in ("JR", "SR", "II", "III", "IV") and len(w) > 1]


def main():
    recs = json.loads(get("public/saln-records.json"))
    names = dict(re.findall(r"id:\s*['\"](sen-\d+)['\"][\s\S]{0,200}?name:\s*['\"]([^'\"]+)", get("app/data/officials.ts")))
    officials = json.load(open("data/officials.json"))
    # their "Bam Aquino" / "Ronald" / "Tito Sotto" -> our id: surname must match; a given name or nickname breaks ties
    ours = [(o["id"], toks(re.sub(r'"[^"]*"', " ", o["name"])), set(toks(" ".join(re.findall(r'"([^"]+)"', o["name"]))))) for o in officials]
    idmap, problems = {}, []
    for sid, n in names.items():
        t = toks(n)
        hit = [i for i, w, nick in ours if t and t[-1] == w[-1] and (set(t[:-1]) & (set(w[:-1]) | nick) or len([1 for _, w2, _ in ours if w2[-1] == t[-1]]) == 1)]
        if not hit and len(t) == 1:   # a name cut short upstream, e.g. "Ronald": first name only, must be unique
            hit = [i for i, w, nick in ours if t[0] in set(w[:-1]) | nick]
        if len(hit) == 1: idmap[sid] = hit[0]
        else: problems.append(f"{sid} {n!r} -> {hit}")
    out = {"_meta": {"source": "https://github.com/bettergovph/saln-tracker-ph", "license": "MIT, BetterGov.ph SALN Tracker",
                     "retrieved": date.today().isoformat(), "upstream_updated": recs["metadata"].get("last_updated"),
                     "note": "Totals as declared in each SALN and as reported by the linked source. Not audited. A date ending -12-31 is the SALN's as-of date; other dates are when the source reported it. Upstream 'year' labels are inconsistent, so the site shows dates."},
           "people": {}}
    for r in recs["records"]:
        i = idmap.get(r["official_id"])
        if not i: continue
        if not (r.get("source_url") or "").startswith("http"): problems.append(f"{r['id']}: no source link, dropped"); continue
        d = r.get("date_filed") or ""
        if not re.fullmatch(r"\d{4}-\d\d-\d\d", d) or int(d[:4]) < r["year"] - 1:   # e.g. a "2025" record dated 2018: can't tell which is right
            problems.append(f"{r['id']}: year {r['year']} vs date {d!r} disagree, dropped"); continue
        out["people"].setdefault(i, []).append({k: r.get(k) for k in ("year", "net_worth", "total_assets", "total_liabilities", "date_filed", "source_url", "source_description")})
    for v in out["people"].values(): v.sort(key=lambda r: r["date_filed"], reverse=True)   # upstream "year" labels are inconsistent; dates are not
    json.dump(out, open("data/saln.json", "w"), indent=1, ensure_ascii=False)
    print(f"{len(out['people'])} senators, {sum(map(len, out['people'].values()))} SALN records (upstream updated {out['_meta']['upstream_updated']})")
    missing = [o["id"] for o in officials if o["id"] not in out["people"]]
    if missing: print("  no SALN:", ", ".join(missing))
    for p in problems: print("  PROBLEM", p)


main()
