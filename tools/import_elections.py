"""Import the election that put each current lawmaker in office into data/elections.json.

Run: python3 tools/import_elections.py   (stdlib only, ~10 requests)
Source: BetterGov.ph "Dynasties" API (https://dynasties.bettergov.ph/developers), derived data CC0 1.0, built from
Open Halalan (Leung, Robert R., https://robertrleung.github.io/OpenHalalan/). Cite Open Halalan for the results.

- Senators: their winning race, 2025 or 2022 (rank, votes).
- District representatives: their 2025 race (votes, share, margin, runner-up), matched by surname plus a given
  name or nickname, inside the same province or city. Only unambiguous matches are kept; the rest are printed.
- Party-list: each group's 2025 national votes and rank.
We match races, not BetterGov's person records: their person matching splits some people across records.
"""
import json, re, sys, unicodedata, urllib.parse, urllib.request
from datetime import date

API = "https://dynasties.bettergov.ph/api/v1"
UA = {"User-Agent": "sinosila/1.0 (+https://sinu-sila.com)"}
SITE = "https://dynasties.bettergov.ph"


def get(path):
    with urllib.request.urlopen(urllib.request.Request(API + path, headers=UA), timeout=60) as r:
        return json.load(r)


def norm(s):
    s = unicodedata.normalize("NFKD", re.sub(r"[\u2010-\u2015-]", " ", s or "")).encode("ascii", "ignore").decode().upper()   # dashes split words
    return re.sub(r"[^A-Z ]+", " ", s).split()


SUFFIX = {"JR", "SR", "II", "III", "IV"}


def ours(name):
    """(surname tokens, given tokens incl. nickname) for one of our names like 'Ronald "Bato" M. Dela Rosa'."""
    nick = set(norm(" ".join(re.findall(r'"([^"]+)"', name))))
    w = [x for x in norm(re.sub(r'"[^"]*"', " ", name)) if x not in SUFFIX and len(x) > 1]
    sur = w[-2:] if len(w) > 2 and w[-2] in ("DE", "DELA", "DEL", "DELOS", "SAN", "STA") else w[-1:]
    return tuple(sur), set(w[: len(w) - len(sur)]) | nick


def theirs(ballot):
    """'DELA ROSA, BATO' -> (('DELA','ROSA'), {'BATO'})"""
    if "," not in ballot: return None
    sur, given = ballot.split(",", 1)
    return tuple(x for x in norm(sur) if x not in SUFFIX), {x for x in norm(given) if x not in SUFFIX}


def match(people, sur, given):
    """people: [(id, (sur, given))]. Same surname, then a shared given name/nickname unless the surname is unique."""
    same = [(i, k) for i, k in people if k[0] == sur or (len(k[0]) == 1 and sur[-1:] == k[0])]
    if len(same) > 1: same = [(i, k) for i, k in same if k[1] & given]
    elif len(same) == 1 and not (same[0][1][1] & given): same = same if len(same[0][1][0]) > 1 or given else []
    return same[0][0] if len(same) == 1 else None


def place_ok(our_place, c):
    """Our place ("Taguig–Pateros", "Cebu City") against their province/city ("SAMAR", city "TAGUIG")."""
    p = set(norm(our_place)) - {"CITY", "OF"}
    for t in (c.get("province"), c.get("city")):
        q = set(norm(t)) - {"CITY", "OF"}
        if q and (q <= p or p <= q): return True
    return False


ORD = {w: i for i, w in enumerate("FIRST SECOND THIRD FOURTH FIFTH SIXTH SEVENTH EIGHTH NINTH TENTH ELEVENTH TWELFTH".split(), 1)}
def same_seat(p, c):
    d = (c.get("district") or "").upper()
    return (p["kind"] == "at-large" and d == "LONE") or (p.get("district") and ORD.get(d) == p["district"])


def flat(t): return "".join(t)


def main():
    senators = json.load(open("data/officials.json"))
    house = json.load(open("data/house.json"))["people"]
    out = {"_meta": {"source": SITE + "/developers", "retrieved": date.today().isoformat(),
                     "credit": "Leung, Robert R. Open Halalan: The Philippine National and Local Election Dataset. https://robertrleung.github.io/OpenHalalan/",
                     "license": "Derived data CC0 1.0 by BetterGov.ph (Dynasties)",
                     "note": "Vote counts as compiled by Open Halalan. District results are matched to members by name inside the same province or city."},
           "senate": {}, "house": {}, "partylist": {}}
    unmatched = []

    # senators: 2025 and 2022 national races
    keys = [(o["id"], ours(o["name"])) for o in senators]
    for year in (2025, 2022):
        res = [r for r in get(f"/national/{year}")["data"]["results"] if r["position"] == "SENATOR"]
        for r in res:
            if not r.get("won"): continue
            t = theirs(r["name"]); i = t and match(keys, *t)
            if not i: unmatched.append(f"senate {year}: {r['name']}"); continue
            if i in out["senate"]: continue
            out["senate"][i] = {"year": year, "rank": r["rank"], "of": len(res), "votes": r["votes"], "seats": 12,
                                "url": f"{SITE}/national"}
    for o in senators:
        if o["id"] not in out["senate"]: unmatched.append(f"senator without a race: {o['id']}")

    # district representatives: every 2025 House race
    contests, page = [], 1
    while True:
        cs = get(f"/contests?year=2025&position=house&candidates=1&limit=100&page={page}")["data"]["contests"]
        contests += cs
        if len(cs) < 100: break
        page += 1
    dist = [p for p in house if p["kind"] != "party-list"]
    keys = [(p["id"], ours(p["name"])) for p in dist]
    byid = {p["id"]: p for p in dist}
    for c in contests:
        cands = sorted(c.get("candidates") or [], key=lambda x: x.get("rank") or 99)
        for w in [x for x in cands if x.get("won")]:
            t = theirs(w.get("ballot_name") or "") or (lambda n: (tuple(n[-1:]), set(n[:-1])))(norm(w["display_name"]))
            here = [(pid, k) for pid, k in keys if place_ok(byid[pid]["place"], c)]
            i = match(here, *t)
            if not i:   # ballot nickname ("ABET" for Albert) or a double surname: same seat plus a shared surname or given name
                seat = [pid for pid, k in here if same_seat(byid[pid], c) and (flat(k[0]).endswith(flat(t[0])) or flat(t[0]).endswith(flat(k[0])) or k[1] & (t[1] | set(norm(w["display_name"]))))]
                i = seat[0] if len(seat) == 1 else None
            if not i: unmatched.append(f"house: {w['display_name']} ({c['id']})"); continue
            ru = next((x for x in cands if not x.get("won")), None)
            out["house"][i] = {"year": 2025, "contest": c["id"], "votes": w.get("votes"), "total": c.get("total_votes"),
                               "rank": w.get("rank"), "candidates": len(cands), "seats": c.get("seats") or 1, "margin": c.get("margin") if (c.get("seats") or 1) == 1 else None,
                               "uncontested": bool(c.get("uncontested")), "party": w.get("party"),
                               "runner_up": ru and (c.get("seats") or 1) == 1 and {"name": ru["display_name"].title(), "party": ru.get("party"), "votes": ru.get("votes")},
                               "url": f"{SITE}/regional"}
    for p in dist:
        if p["id"] not in out["house"]: unmatched.append(f"representative without a 2025 race: {p['id']} ({p['constituency']})")

    # party-list groups: 2025 national votes
    pl = [r for r in get("/national/2025")["data"]["results"] if r["position"] == "PARTY LIST"]
    ours_pl = {p["party"] for p in house if p["kind"] == "party-list"}
    key = lambda s: re.sub(r"[^A-Z0-9]", "", unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().upper())
    theirs_pl = {key(r["name"]): r for r in pl}
    for g in sorted(ours_pl):
        r = theirs_pl.get(key(g))
        if not r:   # "1-Rider" = "1-RIDER PARTY-LIST", "BH" = "BH - BAGONG HENERASYON": a unique prefix
            hits = [r for r in pl if norm(r["name"])[:len(norm(g))] == norm(g)]   # whole words only: "BH" is not "BHW"
            r = hits[0] if len(hits) == 1 else None
        if r: out["partylist"][g] = {"year": 2025, "rank": r["rank"], "of": len(pl), "votes": r["votes"], "url": f"{SITE}/national"}
        else: unmatched.append(f"party-list group: {g}")

    json.dump(out, open("data/elections.json", "w"), indent=1, ensure_ascii=False)
    print(f"senate {len(out['senate'])}/{len(senators)}, house {len(out['house'])}/{len(dist)}, party-list {len(out['partylist'])}/{len(ours_pl)}")
    for u in unmatched: print("  UNMATCHED", u)


main()
