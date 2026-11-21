"""Build data/budget.json: DPWH money per congressional district, from BetterGov's budget API (code MIT, data from
government budget documents; https://budget.bettergov.ph/docs).

Run: python3 tools/import_budget.py        (about 5 minutes; polite, one request at a time)

Per House district: the serving District Engineering Offices (DEOs) and whether each is Lone (serves only this
district) or Shared (serves several; never split), enacted GAA totals FY2020-2026, the FY2027 NEP vs the House bill on
the same named projects, BetterGov's six comparison groups, and the largest House-only / NEP-only / changed projects.
BetterGov's own wording is kept: a "House bill only" project is an insertion *candidate*, not a finding.
"""
import json, os, re, sys, time, unicodedata, urllib.parse, urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API, SITE = "https://budget.bettergov.ph/api/v1", "https://budget.bettergov.ph"
UA = {"User-Agent": "sinu-sila budget importer (+https://sinu-sila.com; https://github.com/lslaoang/sinu-sila)"}
TOP = {"house_only": ("house", "desc", 8), "nep_only": ("nep", "desc", 5), "increased": ("delta", "desc", 3), "decreased": ("delta", "asc", 3)}


def get(path, tries=4):
    for i in range(tries):
        try:
            time.sleep(0.15)
            return json.load(urllib.request.urlopen(urllib.request.Request((SITE if path.startswith("/api") else API) + path, headers=UA), timeout=60))
        except Exception:
            if i == tries - 1: raise
            time.sleep(3 * (i + 1))


slug = lambda s: re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()).strip("-")
ordinal = lambda n: {1: "1st", 2: "2nd", 3: "3rd"}.get(n, f"{n}th")
# drop map coordinates from titles ("Start 18.30, 120.71 End ...", "(17.67, 120.68)")
clean = lambda t: re.sub(r"[\s,;(]*(?:(?:Start|End)\s*)?\d{1,3}\.\s?\d{3,}\s*°?\s*[NE]?\s*[,-]\s*\d{1,3}\.\s?\d{3,}\s*°?\s*[NE]?\s*\)?", "", t).strip(" ,;")
SPECIAL = {"leg:taguigpateros:1st": "leg:taguig-city-pateros:lone", "leg:taguigpateros:2nd": "leg:taguig-city:2nd"}

house = json.load(open(os.path.join(ROOT, "data/house.json")))["people"]
seats = [p for p in house if p.get("kind") != "party-list" and p.get("place")]

L, off = [], 0
while off is not None:
    d = get(f"/hgab/2027/districts?limit=200&offset={off}"); L += d["data"]["districts"]; off = d["data"]["next_offset"]
meta = d["meta"]; theirs = {x["id"]: x for x in L}

offices_cache, out, unmatched = {}, {}, []
for p in seats:
    base = f"leg:{slug(p['place'])}:{ordinal(p['district']) if p.get('district') else 'lone'}"
    bid = next((k for k in (SPECIAL.get(base), base, base.replace(f"leg:{slug(p['place'])}:", f"leg:{slug(p['place'])}-city:")) if k in theirs), None)
    if not bid: unmatched.append(f"{p['id']} ({base})"); continue
    det = get(f"/hgab/2027/districts/{urllib.parse.quote(bid, safe='')}")["data"]
    rep = (det.get("representative") or {}).get("name") or ""
    sur = p["name"].replace(",", "").split()[-1].upper()
    if rep and sur not in rep.upper().replace(",", " ").split() and sur not in rep.upper():
        print(f"  CHECK name: {p['id']} vs BetterGov representative '{rep}' for {bid}")
    gaa, groups, offices, top = {}, {}, [], []
    for o in det["offices"]:
        for y in o["years"]:
            if y["stage"] == "gaa" and y["php"] is not None: gaa[str(y["fy"])] = gaa.get(str(y["fy"]), 0) + y["php"]
        for k, v in o["fy2027"]["bridge"]["groups"].items():
            g = groups.setdefault(k, [0, 0]); g[0] += v["rows"]; g[1] += v["php"] or 0
        offices.append({"name": o["name"], "tier": o["tier"], "shared_with": [c.get("label", c) if isinstance(c, dict) else c for c in o["co_served_districts"]],
                        "url": o["projects_url"]})
        if o["id"] not in offices_cache:
            rows = []
            for grp, (sort, order, n) in TOP.items():
                if not o["fy2027"]["bridge"]["groups"].get(grp, {}).get("rows"): continue
                # held=hide: skip BetterGov's unconfirmed ("possible match") lines, as its own ranked lists do
                for r in get(f"{o['projects_api']}&group={grp}&held=hide&sort={sort}&order={order}&limit={n}")["data"]["rows"]:
                    rows.append({"t": clean(r["title"]), "g": grp,
                                 "nep": r["nep_php"], "house": r["house_php"], "pap": r.get("program"), "office": o["name"], "url": r["url"]})
            offices_cache[o["id"]] = rows
        top += offices_cache[o["id"]]
    h, c = det["headline"], det["fy2027_vs_proposal"]
    out[p["id"]] = {"bg": bid, "label": det["label"], "url": det["url"], "tier": det["attribution"]["code"],
                    "gaa": dict(sorted(gaa.items())), "nep27_office": h.get("fy2027_nep_php"),
                    "cmp27": {"nep": c["nep_php"], "house": c["hgab3_php"], "delta": c["delta_php"], "unconfirmed": c.get("unconfirmed_rows", 0)},
                    "groups": groups, "offices": offices, "top": top}
    print(f"  {p['id']}: {bid} tier {out[p['id']]['tier']}, {len(top)} projects", flush=True)

if len(out) < 240: sys.exit(f"only {len(out)} districts matched; not writing. Unmatched: {unmatched}")
doc = {"_meta": {"source": SITE + "/hgab/2027", "api": SITE + "/docs", "source_repo": meta.get("source_repo"), "source_commit": meta.get("source_commit"),
                 "built_at": meta.get("built_at"), "retrieved": date.today().isoformat(), "notice": meta.get("notice"),
                 "methodology": SITE + "/hgab/2027/methodology#disclaimer", "tier_meaning": meta.get("tier_meaning"),
                 "representatives_note": meta.get("representatives_note"), "licence": "BetterGov budget API (code MIT); figures from Philippine government budget documents"},
       "districts": out}
json.dump(doc, open(os.path.join(ROOT, "data/budget.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print(f"Wrote data/budget.json: {len(out)} districts. Unmatched: {unmatched or 'none'}")
