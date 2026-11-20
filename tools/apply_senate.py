"""Rebuild data/bills.json and data/laws.json from the Senate's own data (read inside a browser tab; see tools/senate_fetch.js).

Main route (works in the Claude app's built-in browser, no Chrome needed):
  python3 tools/apply_senate.py --print-js                 snippet that fetches everything inside a senate.gov.ph tab
  python3 tools/apply_senate.py --print-diff-js [--page N]  snippet that returns only what changed vs. our data, with hashes
  python3 tools/apply_senate.py --patch p0.json [p1.json …] apply those replies (every item's hash is checked)

Fallback route (Claude in Chrome, whose script results are cut at ~1,000 characters):
  python3 tools/apply_senate.py --clipboard                after clicking the page's "Copy Sino Sila data" button
  python3 tools/apply_senate.py <file> [--force]            a saved copy of the full download

Refuses to write (exit 2) if the data looks broken: a senator with zero bills, a total that dropped by more than 5, or
fewer laws than before. A real drop (the Senate does withdraw bills) can be accepted with --force after a person checks
it. Prints a short change summary either way.
"""
import hashlib, html, json, os, re, subprocess, sys
from collections import Counter
from datetime import datetime, date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda f: os.path.join(ROOT, "data", f)
CYR = str.maketrans("АВСЕНКМОРТХІаеорсхуі", "ABCEHKMOPTXIaeopcxyi")    # look-alike letters some titles use
LAW_STATUS = {"6-200": "Approved by the President", "6-210": "Approved by the President, vetoed other parts",
              "6-220": "Lapsed into law", "6-320": "Consolidated with a bill that lapsed into law",
              "4-590": "Enrolled copy sent to Malacañang (awaiting signature)"}

officials = json.load(open(D("officials.json")))
old_bills, old_laws = json.load(open(D("bills.json"))), json.load(open(D("laws.json")))
sha = lambda v: hashlib.sha256(json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
arg = lambda flag, default=None: sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


def snippet(name, *params):
    js = open(os.path.join(ROOT, "tools", name)).read()
    return f"({js[js.index('*/') + 2:].strip()})({', '.join(json.dumps(p, separators=(',', ':')) for p in params)})"


if "--print-js" in sys.argv:
    print(snippet("senate_fetch.js", {o["id"]: o["lis_codes"] for o in officials}, date.today().isoformat())); sys.exit()
if "--print-diff-js" in sys.argv:
    ours = {"bills": {o["id"]: sha(old_bills[o["id"]]) for o in officials if o["id"] in old_bills},
            "laws_raw": old_laws["_meta"].get("raw_sha", "")}
    print(snippet("senate_diff.js", ours, int(arg("--page", "0")))); sys.exit()

title = lambda t: re.sub(r"\s+", " ", html.unescape(t or "").translate(CYR)).strip()
iso = lambda s: datetime.strptime(s.strip(), "%B %d, %Y").date().isoformat()


def entry(rows):
    """One senator's bills.json entry from raw rows [no, title, 'Month D, YYYY', status, id]."""
    rows = [(no, title(t), iso(d), st, bid) for no, t, d, st, bid in rows]
    rows.sort(key=lambda r: (r[2], int(r[4])), reverse=True)
    return {"total": len(rows), "byMonth": dict(sorted(Counter(r[2][:7] for r in rows).items())),
            "byStatus": dict(Counter(r[3] for r in rows).most_common()), "latest": [list(r) for r in rows[:5]]}


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


def build_laws(raw, unmatched):
    laws = []
    for code, no, t, st, bid, au, co, sp in raw:
        e = {"no": no, "title": title(t), "status": LAW_STATUS[code], "id": bid,
             "author": ids(au, unmatched), "coAuthors": ids(co, unmatched), "coSponsors": ids(sp, unmatched)}
        if e["author"] or e["coAuthors"] or e["coSponsors"]: laws.append(e)
    return sorted(laws, key=lambda e: (e["no"][:3] != "SBN", int(re.sub(r"\D", "", e["no"]) or 0)))


# ---- read the input ----
problems, notes, unmatched = [], [], set()
bills = {k: v for k, v in old_bills.items()}
laws, raw_sha = old_laws["bills"], old_laws["_meta"].get("raw_sha")
args = [a for a in sys.argv[1:] if not a.startswith("--") and a != arg("--page")]
if "--patch" in sys.argv:
    parts = [json.load(open(p)) for p in args]
    if not parts: sys.exit("--patch needs the saved reply file(s) of --print-diff-js")
    src_label, retrieved = ", ".join(args), parts[0]["retrieved"]
    want, got = set(parts[0]["changed_ids"]), {}
    for p in parts:
        for i, item in p["entries"].items():
            if sha(item["entry"]) != item["sha"]: sys.exit(f"{i}: hash mismatch, the reply was not copied exactly. Nothing written.")
            e = item["entry"]   # same content, our usual key order (hashes ignore order, git diffs don't)
            got[i] = {"total": e["total"], "byMonth": dict(sorted(e["byMonth"].items())),
                      "byStatus": dict(sorted(e["byStatus"].items(), key=lambda kv: (-kv[1], kv[0]))), "latest": e["latest"]}
        if "laws_raw" in p:
            if sha(p["laws_raw"]["rows"]) != p["laws_raw"]["sha"]: sys.exit("laws_raw: hash mismatch. Nothing written.")
            laws, raw_sha = build_laws(p["laws_raw"]["rows"], unmatched), p["laws_raw"]["sha"]
    if want - got.keys(): sys.exit(f"missing pages: no entries for {sorted(want - got.keys())}. Run --print-diff-js --page N for every page.")
    if parts[0]["senators"] != len(officials): problems.append(f"the page saw {parts[0]['senators']} senators, we have {len(officials)}")
    for i, e in got.items(): bills[i] = e
else:
    if "--clipboard" in sys.argv: src_label, raw = "clipboard", subprocess.run(["pbpaste"], capture_output=True, text=True).stdout
    elif args: src_label, raw = args[0], open(args[0]).read()
    else: sys.exit(__doc__)
    try: src = json.loads(raw); assert {"retrieved", "bills", "laws"} <= src.keys()
    except (ValueError, AssertionError, AttributeError): sys.exit(f"{src_label} does not hold Senate data. Click the yellow button in the senate.gov.ph tab first.")
    retrieved = src["retrieved"]
    for o in officials:
        if src["bills"].get(o["id"]): bills[o["id"]] = entry(src["bills"][o["id"]])
        else: problems.append(f"{o['id']}: no bills in the download")
    laws, raw_sha = build_laws(src["laws"], unmatched), sha(src["laws"])

# ---- checks and summary ----
bills["_meta"] = {**old_bills["_meta"], "retrieved": retrieved}
for o in officials:
    v, was = bills.get(o["id"]), old_bills.get(o["id"], {}).get("total", 0)
    if not v or not v["total"]: problems.append(f"{o['id']}: no bills"); continue
    assert sum(v["byMonth"].values()) == sum(v["byStatus"].values()) == v["total"], o["id"]
    if v["total"] < was - 5: problems.append(f"{o['id']}: total fell from {was} to {v['total']}")
    elif v["total"] != was: notes.append(f"{o['id']}: {was} -> {v['total']} bills")
    elif v != old_bills.get(o["id"]): notes.append(f"{o['id']}: statuses or latest bills changed")
if len(laws) < len(old_laws["bills"]): problems.append(f"laws fell from {len(old_laws['bills'])} to {len(laws)}")
new_laws = sorted({e["no"] for e in laws} - {e["no"] for e in old_laws["bills"]})
moved = [e["no"] for e in laws for p in old_laws["bills"] if p["no"] == e["no"] and p["status"] != e["status"]]

print(f"Source: {src_label} (retrieved {retrieved})")
for n in notes: print("  BILLS ", n)
for n in new_laws: print("  NEW LAW", n)
for n in moved: print("  LAW STATUS CHANGED", n)
for n in sorted(unmatched): print("  NAME NOT MATCHED (not a current senator, or a new spelling):", n)
if not (notes or new_laws or moved): print("  no changes since the last refresh (only the date moves)")
if problems and "--force" not in sys.argv:
    for p in problems: print("  PROBLEM", p)
    sys.exit(2)
json.dump(bills, open(D("bills.json"), "w"), ensure_ascii=False, separators=(",", ":"))
meta = {**old_laws["_meta"], "retrieved": retrieved}
if raw_sha: meta["raw_sha"] = raw_sha
json.dump({"_meta": meta, "bills": laws}, open(D("laws.json"), "w"), indent=1, ensure_ascii=False)
print(f"Wrote bills.json ({len(bills) - 1} senators) and laws.json ({len(laws)} laws).")
