"""Each lawmaker's career in elected office: every race since 2001 and every term in Congress. Writes data/career.json.

  python3 tools/import_career.py --ocd <open-congress-data clone>    (prints a review list; check it before publishing)

Sources (both BetterGov, CC0 data):
  Dynasties (https://dynasties.bettergov.ph, built on Open Halalan): local and House races 2001-2025 per person, and the
    Senate races 2010-2025. People are matched by name, so we only take a record when it is clearly the same person:
    - district representatives: the Dynasties person who won this House seat in 2025 (same province or city);
    - senators and party-list representatives: a unique person with the same surname and a given name (or the ballot
      nickname below), reviewed by hand (REJECT lists the ones that turned out to be someone else).
    Races marked "weak" by Dynasties are dropped, and so is any year where one record shows more than one race (two
    people merged into one record).
  open-congress-data (https://github.com/bettergovph/open-congress-data): which Congresses each lawmaker sat in.
Row: [year, position, place, won (1/0), votes, rank, party, Dynasties person path or ""]
"""
import glob, json, os, re, sys, time, tomllib, unicodedata, urllib.parse, urllib.request
from collections import Counter
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, *p)
API = "https://dynasties.bettergov.ph/api/v1"
UA = {"User-Agent": "sinu-sila importer (+https://sinu-sila.com; https://github.com/lslaoang/sinu-sila)"}
# ballot nicknames for senators whose ballot name differs from their given name
ALIAS = {"christopher-lawrence-t-go": ["BONG"], "ronald-m-dela-rosa": ["BATO"], "joseph-victor-g-ejercito": ["JV"],
         "francis-g-escudero": ["CHIZ"], "panfilo-m-lacson": ["PING"], "manuel-m-lapid": ["LITO"], "robinhood-c-padilla": ["ROBIN"],
         "francis-pangilinan": ["KIKO"], "paolo-benigno-aquino-iv": ["BAM"], "win-gatchalian": ["SHERWIN"], "juan-miguel-f-zubiri": ["MIGZ"],
         "vicente-c-sotto-iii": ["TITO"], "pia-s-cayetano": ["PILAR"], "risa-hontiveros": ["ANA"], "jinggoy-ejercito-estrada": ["JOSE"], "imee-r-marcos": ["MARIA"]}
# Records picked by hand from the review list: (name, province on Dynasties[, town to leave out because another person's races are mixed in])
HAND = {"jenny-barzaga": [("JENNY AUSTRIA BARZAGA", "CAVITE"), ("JENNIFER AUSTRIA BARZAGA", "CAVITE", "CARMONA")],   # her son Kiko won the seat in 2025; she took it in 2026
             "win-gatchalian": [("SHERWIN TING GATCHALIAN", "NCR THIRD DISTRICT")],
             "juan-miguel-f-zubiri": [("JUAN MIGUEL F. ZUBIRI", "BUKIDNON"), ("JUAN MIGUEL ZUBIRI", "BUKIDNON")],
             "alan-peter-s-cayetano": [("ALAN PETER S. CAYETANO", "NCR FOURTH DISTRICT"), ("ALAN PETER MANILA CAYETANO", "NCR FOURTH DISTRICT")],
             "pia-s-cayetano": [("PIA CAYETANO", "NCR FOURTH DISTRICT")],
             "joseph-victor-g-ejercito": [("JOSEPH VICTOR GOMEZ EJERCITO", "NCR SECOND DISTRICT"), ("JOSEPH VICTOR G. EJERCITO", "NCR SECOND DISTRICT")],
             "francis-g-escudero": [("FRANCIS JOSEPH G. ESCUDERO", "SORSOGON"), ("FRANCIS JOSEPH GUEVARA ESCUDERO", "SORSOGON"), ("CHIZ ESCUDERO", "SORSOGON")],
             "manuel-m-lapid": [("MANUEL M. LAPID", "PAMPANGA")],
             "imee-r-marcos": [("MARIA IMELDA MARCOS", "ILOCOS NORTE"), ("MARIA IMELDA R. MARCOS", "ILOCOS NORTE"), ("IMEE MARCOS", "ILOCOS NORTE")],
             "camille-a-villar": [("CAMILLE VILLAR", "NCR FOURTH DISTRICT")], "mark-a-villar": [("MARK VILLAR", "NCR FOURTH DISTRICT")]}
# Party-list nominees have no seat to check against: only these name matches were confirmed on review
PL_OK = {"elmer-catulpos", "marcelino-libanan", "jonathan-clement-abalos", "robert-raymond-estrella", "alfredo-garbin", "arthur-c-yap",
         "ching-bernos", "jose-teves-jr", "yedda-romualdez"}
REJECT = {"jenny-barzaga:5d751aa46c"}   # "<our id>:<dynasties person id>" found to be someone else on review (2025 winner on file is KIKO Barzaga)

fold = lambda s: unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().upper()
words = lambda s: set(re.findall(r"[A-Z]{2,}", fold(s)))   # initials ("S.") are shared by siblings: never match on them
SUFFIX = {"JR", "SR", "II", "III", "IV"}
PART = {"DE", "DEL", "DELA", "DELOS", "LA", "LOS", "SAN", "STA", "STO"}

def split(name):
    """'Carmelo Lazatin Jr.' -> ('LAZATIN', {'CARMELO'}, 'JR'); keeps particles ('Dela Rosa')."""
    nick = re.findall(r'"([^"]+)"', name)
    w = [x for x in re.sub(r'"[^"]*"', " ", fold(name)).replace(".", " ").split()]
    suf = next((x for x in w if x in SUFFIX), "")
    w = [x for x in w if x not in SUFFIX]
    i = len(w) - 1
    while i > 1 and w[i - 1] in PART: i -= 1
    return " ".join(w[i:]), set(w[:i]) | {fold(n) for n in nick}, suf

CACHE = D("review/career_cache.json")   # git-ignored; delete it to re-read everything
cache = json.load(open(CACHE)) if os.path.exists(CACHE) and "--fresh" not in sys.argv else {}
def get(path):
    if path in cache: return cache[path]
    cache[path] = fetch(path); return cache[path]

def fetch(path):
    for t in range(4):
        try:
            time.sleep(0.25)
            return json.load(urllib.request.urlopen(urllib.request.Request(API + path, headers=UA), timeout=60))["data"]
        except Exception:
            if t == 3: raise
            time.sleep(3 * (t + 1))

search_cache = {}
def search(last):
    if last not in search_cache:
        search_cache[last] = [p for p in get(f"/persons?q={urllib.parse.quote(last)}&limit=1000")["persons"] if fold(p["last_name"]) == last or last in re.split(r"[-\s]+", fold(p["last_name"]))]
    return search_cache[last]

person_cache = {}
def person(pid):
    if pid not in person_cache: person_cache[pid] = get(f"/persons/{pid}")
    return person_cache[pid]

MULTI = re.compile(r"COUNCIL|BOARD|SANGGUNIAN")   # seats with several winners
def races(p):
    """The person's races, without weak matches and without years where the record holds two races. A record with such
    a year mixes two people (a father and son with one name), so its council and board races, where namesakes run, go too."""
    c = [x for x in p["candidacies"] if x.get("match_confidence") != "weak"]
    per = Counter(x["year"] for x in c)
    mixed = any(n > 1 for n in per.values())
    return [x for x in c if per[x["year"]] == 1 and not (mixed and MULTI.search(x["position"]))]
def won(x):
    """1, 0, or None when the source has the votes but no winners for that race (vote_link 'votes-only', seats 0):
    then first place in a one-seat race won, the rest lost, and a several-seat race stays unknown."""
    if x.get("won"): return 1
    if not x.get("seats") and x.get("rank"):
        return None if MULTI.search(x["position"]) else int(x["rank"] == 1)
    return 0

POS = {"MEMBER, HOUSE OF REPRESENTATIVES": "House representative", "PROVINCIAL BOARD MEMBER": "Provincial board member", "ARMM ASSEMBLYMAN": "ARMM assemblyman"}
pos = lambda s: POS.get(s, s.capitalize())
def row(x, p):
    place = ", ".join(re.sub(r"\b(De|Del|Dela|Of)\b", lambda m: m[0].lower(), s.title()).replace("Ncr", "NCR") for s in [x.get("city"), x.get("province")] if s)
    if x.get("district") and x["district"] not in ("LONE",): place += f" ({x['district'].title()} District)"
    return [x["year"], pos(x["position"]), place, won(x), x.get("votes"), x.get("rank"), x.get("party") or "",
            f"/person/{p['province_slug']}/{p['id']}"]

def merge(rows):
    """One row per year and office (a person split across two records repeats races); newest first."""
    best = {}
    for r in rows:
        k = (r[0], r[1]); best[k] = max(best.get(k, r), r, key=lambda z: (z[3] is not None, z[4] or 0))
    return sorted(best.values(), key=lambda r: (r[0], r[1]), reverse=True)

def hand(oid, last):
    rows, want = [], HAND.get(oid, [])
    for name, prov, *skip in want:
        ps = [p for p in search(last) if fold(p["display_name"]) == name and fold(p["province"]) == prov]
        if not ps: review.append(f"HAND {oid}: {name} ({prov}) not found")
        rows += [row(x, p) for p in ps for x in races(person(p["id"])) if fold(x.get("city")) not in skip]
    return rows

ORD = ["", "FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "EIGHTH", "NINTH", "TENTH", "ELEVENTH", "TWELFTH"]
officials = json.load(open(D("data/officials.json")))
house = json.load(open(D("data/house.json")))["people"]
out, review = {}, []

# ---- district representatives: the same-surname person who won this seat in 2025 (ballot names vary: "JB NIÑO BERNOS") ----
for o in house:
    last, given, suf = split(o["name"])
    parts = [x for x in re.split(r"[-–\s]+", last) if x not in PART]   # "BANAS-NOGRALES", "DEL MAR": try each part and the whole
    same = list({p["id"]: p for q in dict.fromkeys([last, last.replace(" ", ""), *parts]) for p in search(q)}.values())
    anchor = []
    if o["id"] in HAND:
        rows = merge(hand(o["id"], last)); out[o["id"]] = {"races": rows}; continue
    if o["kind"] == "party-list":
        anchor = [p for p in same if (words(p["first_name"]) | words(p["display_name"])) & given and fold(p.get("suffix")) == suf]
        if len(anchor) == 1 and o["id"] not in PL_OK: review.append(f"PARTY-LIST UNCONFIRMED {o['id']} = {anchor[0]['display_name']} ({anchor[0]['province']})")
        anchor = anchor if len(anchor) == 1 and o["id"] in PL_OK else []
    else:
        place = words(o["place"]) - {"CITY", "OF", "DEL", "DE", "THE"}
        dist = ORD[o["district"]] if o.get("district") else "LONE"
        for p in same:
            for x in person(p["id"])["candidacies"]:
                if (x["year"] == 2025 and "HOUSE" in x["position"] and won(x) == 1 and x.get("district", "") in ("", dist)
                        and place <= words(f"{x.get('province')} {x.get('city')} {p['province']}")):
                    anchor.append(p); break
        if len(anchor) > 1: review.append(f"AMBIGUOUS {o['id']}: {[p['display_name'] for p in anchor]}"); anchor = []
        if anchor and not (words(anchor[0]["display_name"]) & given):
            review.append(f"BY SEAT {o['id']} ({o['name']}) = {anchor[0]['display_name']}")
    if anchor:   # the same person under a second record in the same province ("JANETTE DOC NANAY GARIN")
        a = anchor[0]
        anchor += [p for p in same if p is not a and p["province_slug"] == a["province_slug"] and fold(p["first_name"]) == fold(a["first_name"])
                   and fold(p.get("suffix")) == fold(a.get("suffix")) and fold(p.get("middle_name"))[:1] in ("", fold(a.get("middle_name"))[:1])
                   and (fold(a.get("middle_name"))[:1] or not fold(p.get("middle_name")))]   # the Revillas are all "Ramon": first name and middle initial must agree
    anchor = [p for p in anchor if f"{o['id']}:{p['id']}" not in REJECT]
    rows = merge([row(x, p) for p in anchor for x in races(person(p["id"]))])
    if rows: out[o["id"]] = {"races": rows}
    if o["kind"] == "party-list" and rows: review.append(f"PARTY-LIST {o['id']} = {anchor[0]['display_name']} ({anchor[0]['province']}): " + "; ".join(f"{r[0]} {r[1]} {r[2]}" for r in rows))
    if o["kind"] != "party-list" and not rows: review.append(f"NO MATCH {o['id']} ({o['name']}, {o['place']})")

# ---- senators: Senate races 2010-2025 by ballot name, plus local races of a unique same-name person ----
nat = {y: get(f"/national/{y}")["results"] for y in (2010, 2013, 2016, 2019, 2022, 2025)}
for o in officials:
    last, given, suf = split(o["name"])
    given |= set(ALIAS.get(o["id"], []))
    rows = []
    for y, rs in nat.items():
        for x in rs:
            if x["position"] != "SENATOR": continue
            sur, _, rest = x["name"].partition(",")
            if f" {last} " in f" {' '.join(re.split(r'[-\s]+', fold(sur)))} " and words(rest) & given:   # "HONTIVEROS-BARAQUEL", "EJERCITO ESTRADA"
                rows.append([y, "Senator", "Nationwide", won(x), x.get("votes"), x.get("rank"), x.get("party") or "", f"/national/{y}"])
    loc = hand(o["id"], last)
    rows += loc
    if loc: review.append(f"SENATOR {o['id']}: " + "; ".join(f"{r[0]} {r[1]} {r[2]}" for r in sorted(loc)))
    if rows: out[o["id"]] = {"races": merge(rows)}

# ---- terms in Congress (open-congress-data) ----
ocd = sys.argv[sys.argv.index("--ocd") + 1] if "--ocd" in sys.argv else None
if ocd:
    official = json.load(open(D("data/house_bills.json")))["official"]
    by_h = {v.rsplit("/", 1)[1]: k for k, v in official.items()}
    by_s = {c: o["id"] for o in officials for c in o["lis_codes"]}
    for f in glob.glob(f"{ocd}/data/person/*.toml"):
        p = tomllib.load(open(f, "rb"))
        ids = {by_h[k] for k in p.get("congress_website_author_keys", []) if k in by_h} | {by_s[k] for k in p.get("senate_website_keys", []) if k in by_s}
        if len(ids) != 1: continue
        t = out.setdefault(ids.pop(), {}).setdefault("terms", {})
        for m in p.get("memberships", []):
            if m.get("type") == "chamber": t.setdefault(m["subtype"], set()).add(m["congress"])
    for v in out.values():
        if "terms" in v: v["terms"] = {k: sorted(s) for k, s in v["terms"].items()}

meta = {"retrieved": date.today().isoformat(), "site": "https://dynasties.bettergov.ph",
        "sources": ["https://dynasties.bettergov.ph", "https://robertrleung.github.io/OpenHalalan/", "https://github.com/bettergovph/open-congress-data"],
        "note": "Races 2001-2025 from BetterGov Dynasties (Open Halalan), matched by name; terms in Congress from open-congress-data. Senate races before 2010 are not in the source."}
json.dump({"_meta": meta, "people": dict(sorted(out.items()))}, open(D("data/career.json"), "w"), ensure_ascii=False, separators=(",", ":"))
json.dump(cache, open(CACHE, "w"))
open(D("review/career_review.txt"), "w").write("\n".join(review) + "\n")
print(f"{sum(1 for v in out.values() if v.get('races'))} lawmakers with races, {sum(1 for v in out.values() if v.get('terms'))} with terms; "
      f"{sum(1 for r in review if r.startswith('NO MATCH'))} district reps unmatched; review list in review/career_review.txt")
