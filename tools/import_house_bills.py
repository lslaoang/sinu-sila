"""Build data/house_bills.json (counts) and data/house_bills_detail.json (titles): bills each House member authored in the 20th Congress, from BatasWatch
(https://bills.juris.ph/api, CC0; official records from congress.gov.ph).

Run: python3 tools/import_house_bills.py        (about 2 minutes, ~120 requests)

Per member: bills filed as a principal author (and how many they are listed first on), how many of those passed the
House, and how many became law. A bill substituted by or consolidated into another bill counts as passed / law when
that bill did, so authors of bills folded into a committee substitute get credit too. BatasWatch does not record
co-authors (credits added after filing), so those are not counted.
"""
import json, os, re, sys, time, unicodedata, urllib.parse, urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://bills.juris.ph/api"
UA = {"User-Agent": "sinu-sila importer (+https://sinu-sila.com; https://github.com/lslaoang/sinu-sila)"}


def get(path):
    for i in range(4):
        try:
            time.sleep(0.2)
            return json.load(urllib.request.urlopen(urllib.request.Request(API + path, headers=UA), timeout=90))
        except Exception:
            if i == 3: raise
            time.sleep(3 * (i + 1))


norm = lambda s: re.sub(r"[^a-z ]", "", unicodedata.normalize("NFKD", re.sub(r"[-–]", " ", s)).encode("ascii", "ignore").decode().lower()).strip()
ORD = {"1st": 1, "2nd": 2, "3rd": 3}

# ---- all House bills of the 20th Congress ----
bills, page = [], 1
while True:
    m = get(f"/measures?congress=20&chamber=house&sort=latest&per_page=100&page={page}")
    bills += m["items"]; meta = m["meta"]
    if page * 100 >= meta["total"]: break
    page += 1
byno = {b["number"]: b for b in bills}
ALLNAMES = {n for b in bills for n in (b.get("primaryAuthors") or [])}

CYR = str.maketrans("АВСЕНКМОРТХІаеорсхуі", "ABCEHKMOPTXIaeopcxyi")   # look-alike letters some titles use
ENACTED = re.compile(r"republic act|lapsed into law|approved by the president", re.I)
PASSED = re.compile(r"approved by the house|third reading|conference|bicameral|enrolled", re.I)
LINK = re.compile(r"(?:substituted by|consolidated into)\s+(HB\d+)", re.I)


def level(b, seen=()):
    """2 = became law, 1 = passed the House, 0 = neither; follows substitution / consolidation."""
    st = b.get("status") or ""
    if ENACTED.search(st): return 2
    if PASSED.search(st): return 1
    m = LINK.search(st)
    if m and m.group(1) in byno and m.group(1) not in seen: return level(byno[m.group(1)], seen + (b["number"],))
    return 0


# ---- BatasWatch authors -> our House ids ----
authors = get("/authors?congress=20&chamber=house&per_page=500")["items"]
house = json.load(open(os.path.join(ROOT, "data/house.json")))["people"]


def ours(a):
    """Score our members on surname, given name / nickname and seat; take the single best with a surname hit."""
    rep, cn = a.get("representation") or "", a["canonicalName"]
    sur, given = (cn.split(",", 1) + [""])[:2] if "," in cn else (cn.split(".", 1) + [""])[:2]
    sur, gtok = norm(sur).split(), [w for w in norm(re.sub(r'"[^"]*"', "", given)).split() if len(w) > 1 and w not in ("jr", "sr", "ii", "iii", "iv", "md", "atty", "ma", "dr")]
    nick = [norm(x) for x in re.findall(r'"([^"]+)"', cn)]
    m = re.match(r"(.+?),\s*(\w+) District", rep)
    seat = (norm(m.group(1)).replace(" city", "").split()[0], ORD.get(m.group(2), int(re.sub(r"\D", "", m.group(2)) or 0) or None)) if m else None
    best = []
    for p in house:
        toks = norm(p["name"]).split()
        if not sur or not any(t in toks for t in sur): continue
        sc = 2 if any(t.startswith(g) or g.startswith(t) for g in gtok[:2] + nick for t in toks) else 0
        if seat and p.get("kind") != "party-list" and norm(p["place"]).startswith(seat[0]) and (seat[1] is None or (p.get("district") or None) in (seat[1], None)): sc += 3
        if not seat and p.get("kind") == "party-list" and set(norm(p["party"]).split()) & set(norm(rep).split()): sc += 2
        if sc >= 2: best.append((sc, p["id"]))
    best.sort(reverse=True)
    return best[0][::-1] if best and (len(best) == 1 or best[0][0] > best[1][0]) else (None, 0)


out, unmatched, score = {}, [], {}
for a in authors:
    pid, sc = ours(a)
    if not pid: unmatched.append(f"{a['canonicalName']} ({a['representation']})"); continue
    if score.get(pid, -1) >= sc: print(f"  SAME SEAT, kept the better name match over {a['canonicalName']}"); continue   # e.g. a predecessor in the same seat
    score[pid] = sc
    names = {a["canonicalName"]}
    if not any(a["canonicalName"] in (x.get("primaryAuthors") or []) for x in bills):
        # the profile name can differ from the name printed on bills ("CRUZ, AGATHA PAULA AGUILAR" vs 'CRUZ, AGATHA "Agay"'):
        # fall back to the bill-author names with the same surname and a given name in common
        sur, given = (a["canonicalName"].split(",", 1) + [""])[:2]
        gt = set(norm(re.sub(r'"[^"]*"', "", given)).split())
        names = {n for n in ALLNAMES if n.split(",")[0].strip().upper() == sur.strip().upper() and gt & set(norm(re.sub(r'"[^"]*"', "", n.split(",", 1)[-1])).split())}
        print(f"  NAME FALLBACK: {a['canonicalName']} -> {sorted(names)}")
    mine = [b for b in bills if names & set(b.get("primaryAuthors") or [])]
    lead = sum(1 for b in mine if b["primaryAuthors"][0] in names)
    lv = [(b, level(b)) for b in mine]
    recent = sorted(mine, key=lambda b: (b.get("filedAt") or "", b["sequence"]), reverse=True)[:5]
    laws = [b for b, l in lv if l == 2]
    out[pid] = {"filed": len(mine), "lead": lead, "passed": sum(1 for _, l in lv if l >= 1), "law": len(laws),
                "latest": [[b["number"], b["title"].translate(CYR), b.get("filedAt"), b.get("status"), f"https://bills.juris.ph/bills/house/{b['number'].lower()}"] for b in recent],
                "laws": [[b["number"], b["title"].translate(CYR), b.get("status")] for b in laws][:10],
                "bw": f"https://bills.juris.ph/authors/house?author={urllib.parse.quote_plus(a['canonicalName'])}", "official": a.get("officialProfileUrl")}

dist = [p for p in house if p.get("kind")]
missing = [p["id"] for p in dist if p["id"] not in out]
print(f"matched {len(out)} of {len(authors)} BatasWatch authors; our members without a match: {len(missing)}")
for u in unmatched: print("  NOT MATCHED:", u)
if len(out) < 280: sys.exit("too few matches; not writing")
META = {"source": "https://bills.juris.ph", "api": API, "licence": "CC0 1.0 (BatasWatch); official records from congress.gov.ph",
        "discovered_as_of": (meta.get("discoveredAsOf") or "")[:10], "retrieved": date.today().isoformat(), "bills": len(bills),
        "note": "Principal authors only. A bill substituted by or consolidated into a bill that passed or became law counts as passed or law."}
# small file (counts, loaded with the site) + detail file (titles, loaded when a House profile opens)
json.dump({"_meta": META, "members": {k: [v["filed"], v["lead"], v["passed"], v["law"]] for k, v in out.items()},
           "official": {k: v["official"] for k, v in out.items() if v.get("official")}},
          open(os.path.join(ROOT, "data/house_bills.json"), "w"), ensure_ascii=False, separators=(",", ":"))
json.dump({"_meta": META, "members": {k: {x: v[x] for x in ("latest", "laws", "bw")} for k, v in out.items()}},
          open(os.path.join(ROOT, "data/house_bills_detail.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print(f"Wrote data/house_bills.json and house_bills_detail.json ({len(out)} members, {len(bills)} bills)")
