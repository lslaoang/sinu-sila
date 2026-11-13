"""Import one city's or town's elected officials (2025) for the local report-card pilot. BetterGov.ph first.

Run: python3 tools/import_local.py camarines-sur naga "Naga City"   ->  data/local/naga.json
Source: BetterGov.ph Dynasties API (https://dynasties.bettergov.ph/developers), derived data CC0 1.0, built from
Open Halalan (Leung, Robert R.). Only winners of the 2025 local races are kept: mayor, vice mayor, councilors.
The city's transparency checklist (data/local/<town>.json "checklist") is curated by hand, BetterGov sources first.
"""
import json, os, sys, urllib.request
from datetime import date

API = "https://dynasties.bettergov.ph/api/v1"
UA = {"User-Agent": "sinosila/1.0 (+https://sinu-sila.com)"}
ORDER = {"MAYOR": 0, "VICE MAYOR": 1, "COUNCILOR": 2}


def get(path):
    with urllib.request.urlopen(urllib.request.Request(API + path, headers=UA), timeout=60) as r:
        return json.load(r)


def main(province, town, label):
    cs = get(f"/contests?year=2025&province={province}&town={town}&candidates=1&limit=100")["data"]["contests"]
    people = []
    for c in cs:
        if c["position"] not in ORDER: continue
        for w in sorted((x for x in c["candidates"] if x.get("won")), key=lambda x: x.get("rank") or 99):
            people.append({"name": w["display_name"].title(), "position": c["position"].title(), "party": w.get("party"),
                           "votes": w.get("votes"), "rank": w.get("rank"), "seats": c.get("seats"), "candidates": len(c["candidates"]),
                           "contest": c["id"], "bettergov_person": w.get("person_id")})
    people.sort(key=lambda p: (ORDER[p["position"].upper()], p["rank"] or 99))
    path = f"data/local/{town}.json"
    old = json.load(open(path)) if os.path.exists(path) else {}
    out = {"_meta": {"place": label, "province": province, "town": town, "retrieved": date.today().isoformat(),
                     "source": f"https://dynasties.bettergov.ph/regional", "api": f"{API}/contests?year=2025&province={province}&town={town}",
                     "credit": "BetterGov.ph Dynasties (CC0), from Open Halalan (Leung, Robert R.)"},
           "officials": people, "checklist": old.get("checklist", [])}
    os.makedirs("data/local", exist_ok=True)
    json.dump(out, open(path, "w"), indent=1, ensure_ascii=False)
    print(f"{label}: {len(people)} officials ->", path)
    for p in people: print(f"  {p['position']:10} {p['name']:32} {p['party'] or '':5} {p['votes']}")


main(*sys.argv[1:4])
