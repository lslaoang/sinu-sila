"""Build data/facts.json: date and place of birth for each lawmaker, from Wikidata (CC0), found through the Wikipedia
article we already link on each profile. Only these two public facts are kept: no family, home address or other
personal details.

Run: python3 tools/import_facts.py        (about a minute)
"""
import json, os, time, urllib.parse, urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "sinu-sila importer (+https://sinu-sila.com; https://github.com/lslaoang/sinu-sila)"}
get = lambda u: (time.sleep(0.1), json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60)))[1]

people = json.load(open(os.path.join(ROOT, "data/officials.json"))) + json.load(open(os.path.join(ROOT, "data/house.json")))["people"]
titles = {urllib.parse.unquote(p["wikipedia"].rsplit("/wiki/", 1)[1]).replace("_", " "): p["id"] for p in people if p.get("wikipedia") and "/wiki/" in p["wikipedia"]}

qid = {}   # Wikipedia title -> Wikidata id (follows redirects)
names = list(titles)
for i in range(0, len(names), 50):
    r = get("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({"action": "query", "prop": "pageprops", "ppprop": "wikibase_item", "redirects": 1, "format": "json", "titles": "|".join(names[i:i + 50])}))["query"]
    back = {x["to"]: x["from"] for x in r.get("redirects", []) + r.get("normalized", [])}
    for pg in r["pages"].values():
        t = pg.get("title"); t0 = back.get(t, t); t0 = back.get(t0, t0)
        if pg.get("pageprops", {}).get("wikibase_item") and t0 in titles: qid[titles[t0]] = pg["pageprops"]["wikibase_item"]

ents, ids = {}, list(set(qid.values()))
for i in range(0, len(ids), 50):
    ents.update(get("https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({"action": "wbgetentities", "ids": "|".join(ids[i:i + 50]), "props": "claims", "format": "json"}))["entities"])
claim = lambda e, p: [c["mainsnak"].get("datavalue", {}).get("value") for c in e.get("claims", {}).get(p, []) if c.get("rank") != "deprecated"]

places = {}
facts = {}
for pid, q in qid.items():
    e = ents.get(q, {}); born = [v for v in claim(e, "P569") if v]; bp = [v for v in claim(e, "P19") if v]
    f = {"wd": q}
    if len(born) == 1 and born[0]["precision"] >= 9:   # day (11) or year (9); skip conflicting dates
        t = born[0]["time"].lstrip("+")
        f["born"] = t[:10] if born[0]["precision"] == 11 else t[:4]
    if len(bp) == 1: f["place_q"] = bp[0]["id"]; places[bp[0]["id"]] = None
    facts[pid] = f
pq = list(places)
for i in range(0, len(pq), 50):
    for k, v in get("https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({"action": "wbgetentities", "ids": "|".join(pq[i:i + 50]), "props": "labels", "languages": "en", "format": "json"}))["entities"].items():
        places[k] = v.get("labels", {}).get("en", {}).get("value")
for f in facts.values():
    if f.get("place_q") and places.get(f["place_q"]): f["place"] = places[f.pop("place_q")]
    else: f.pop("place_q", None)

json.dump({"_meta": {"source": "https://www.wikidata.org", "licence": "CC0 1.0", "retrieved": date.today().isoformat(),
                     "note": "Date and place of birth only, from each lawmaker's Wikidata item (linked from the Wikipedia article on the profile)."},
           "people": facts}, open(os.path.join(ROOT, "data/facts.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print(f"{len(people)} lawmakers, {len(titles)} with Wikipedia, {len(qid)} on Wikidata, {sum('born' in f for f in facts.values())} with a birth date, {sum('place' in f for f in facts.values())} with a birthplace")
