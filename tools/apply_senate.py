"""Rebuild data/bills.json and data/laws.json from a Senate download.

  python3 tools/apply_senate.py --print-js      prints the snippet to run in a senate.gov.ph tab (see tools/senate_fetch.js)
  python3 tools/apply_senate.py --clipboard      reads the data the page's "Copy Sino Sila data" button put on the clipboard
  python3 tools/apply_senate.py <file> [--force]  reads a saved copy instead

Refuses to write (exit 2) if the download looks broken: a senator with zero bills, a total that dropped by more
than 5, or fewer laws than before. A real drop (the Senate does withdraw bills) can be accepted with --force after a
person checks it. Prints a short change summary either way.
"""
import html, json, os, re, subprocess, sys
from collections import Counter
from datetime import datetime, date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda f: os.path.join(ROOT, "data", f)
CYR = str.maketrans("АВСЕНКМОРТХІаеорсхуі", "ABCEHKMOPTXIaeopcxyi")    # look-alike letters some titles use
LAW_STATUS = {"6-200": "Approved by the President", "6-210": "Approved by the President, vetoed other parts",
              "6-220": "Lapsed into law", "6-320": "Consolidated with a bill that lapsed into law",
              "4-590": "Enrolled copy sent to Malacañang (awaiting signature)"}

officials = json.load(open(D("officials.json")))

if "--print-js" in sys.argv:
    js = open(os.path.join(ROOT, "tools", "senate_fetch.js")).read()
    js = js[js.index("*/") + 2:].strip()
    lis = {o["id"]: o["lis_codes"] for o in officials}
    print(f"({js})({json.dumps(lis, separators=(',', ':'))}, {json.dumps(date.today().isoformat())})")
    sys.exit()

args = [a for a in sys.argv[1:] if not a.startswith("--")]
if "--clipboard" in sys.argv:
    path, raw = "clipboard", subprocess.run(["pbpaste"], capture_output=True, text=True).stdout
elif args: path, raw = args[0], open(args[0]).read()
else: sys.exit(__doc__)
try: src = json.loads(raw); assert {"retrieved", "bills", "laws"} <= src.keys()
except (ValueError, AssertionError, AttributeError): sys.exit(f"{path} does not hold Senate data. Click the yellow button in the senate.gov.ph tab first.")
title = lambda t: re.sub(r"\s+", " ", html.unescape(t or "").translate(CYR)).strip()
iso = lambda s: datetime.strptime(s.strip(), "%B %d, %Y").date().isoformat()

# ---- bills: per senator totals, per month, per status, 5 latest ----
old_bills = json.load(open(D("bills.json")))
bills = {"_meta": {**old_bills["_meta"], "retrieved": src["retrieved"]}}
problems, notes = [], []
for o in officials:
    rows = src["bills"].get(o["id"])
    if not rows: problems.append(f"{o['id']}: no bills in the download"); continue
    rows = [(no, title(t), iso(d), st, bid) for no, t, d, st, bid in rows]
    rows.sort(key=lambda r: (r[2], int(r[4])), reverse=True)
    bills[o["id"]] = {"total": len(rows), "byMonth": dict(sorted(Counter(r[2][:7] for r in rows).items())),
                      "byStatus": dict(Counter(r[3] for r in rows).most_common()), "latest": [list(r) for r in rows[:5]]}
    was = old_bills.get(o["id"], {}).get("total", 0)
    if len(rows) < was - 5: problems.append(f"{o['id']}: total fell from {was} to {len(rows)}")
    elif len(rows) != was: notes.append(f"{o['id']}: {was} -> {len(rows)} bills")
for k, v in bills.items():
    if k != "_meta": assert sum(v["byMonth"].values()) == sum(v["byStatus"].values()) == v["total"], k

# ---- laws: map the Senate's "SURNAME, GIVEN" name lists to our ids ----
def keys(o):
    n = re.sub(r'"[^"]*"', "", o["name"]).split()
    n = [w for w in n if not re.fullmatch(r"(Jr\.?|Sr\.?|II|III|IV|[A-Z]\.)", w)]
    sur = n[-1].upper() if not (len(n) > 2 and n[-2].lower() in ("de", "dela", "del", "delos")) else " ".join(n[-2:]).upper()
    given = {n[0].upper()} | {x.upper() for x in re.findall(r'"([^"]+)"', o["name"])}
    return sur, given
KEYS = {o["id"]: keys(o) for o in officials}
def ids(names, unmatched):
    if not names or names == "null": return []
    parts = [p.strip() for p in names.split(",")]
    out = []
    for sur, given in zip(parts[0::2], parts[1::2]):
        sur = re.sub(r"\s+(JR\.?|SR\.?|II|III|IV)$", "", sur.strip(), flags=re.I)    # "SOTTO III, VICENTE C."
        g = re.sub(r'"', "", given).split()[0].upper() if given.strip() else ""
        nick = {x.upper() for x in re.findall(r'"([^"]+)"', given)}
        hit = [i for i, (s, gs) in KEYS.items() if sur.upper().endswith(s) and (g in gs or nick & gs)]
        if len(hit) == 1: out.append(hit[0])
        else: unmatched.add(f"{sur}, {given}")
    return out

old_laws = json.load(open(D("laws.json")))
unmatched, laws = set(), []
for code, no, t, st, bid, au, co, sp in src["laws"]:
    e = {"no": no, "title": title(t), "status": LAW_STATUS[code], "id": bid,
         "author": ids(au, unmatched), "coAuthors": ids(co, unmatched), "coSponsors": ids(sp, unmatched)}
    if e["author"] or e["coAuthors"] or e["coSponsors"]: laws.append(e)
laws.sort(key=lambda e: (e["no"][:3] != "SBN", int(re.sub(r"\D", "", e["no"]) or 0)))
if len(laws) < len(old_laws["bills"]): problems.append(f"laws fell from {len(old_laws['bills'])} to {len(laws)}")
new_laws = sorted({e["no"] for e in laws} - {e["no"] for e in old_laws["bills"]})
moved = [e["no"] for e in laws for p in old_laws["bills"] if p["no"] == e["no"] and p["status"] != e["status"]]

print(f"Download: {path} (retrieved {src['retrieved']})")
for n in notes: print("  BILLS ", n)
for n in new_laws: print("  NEW LAW", n)
for n in moved: print("  LAW STATUS CHANGED", n)
for n in sorted(unmatched): print("  NAME NOT MATCHED (not a current senator, or a new spelling):", n)
if problems and "--force" not in sys.argv:
    for p in problems: print("  PROBLEM", p)
    sys.exit(2)
json.dump(bills, open(D("bills.json"), "w"), ensure_ascii=False, separators=(",", ":"))
json.dump({"_meta": {**old_laws["_meta"], "retrieved": src["retrieved"]}, "bills": laws}, open(D("laws.json"), "w"), indent=1, ensure_ascii=False)
print(f"Wrote bills.json ({len(bills) - 1} senators) and laws.json ({len(laws)} laws).")
