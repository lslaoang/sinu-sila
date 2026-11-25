"""Per-term bill counts for the ranking's term choice: data/billterms.json from data/billhist/*.json.

  python3 tools/bill_terms.py      (run after tools/import_bill_history.py)

For each lawmaker, chamber (S or H) and Congress before the 20th: [filed, passed their chamber, became law].
  became law: signed, lapsed into law, or folded into a bill that became law ("Consolidated with Approved Bill");
  passed: became law, or the record shows it left the chamber (sent to the other chamber, conference, enrolled, vetoed).
The 20th Congress keeps the site's own counts (data/bills.json, data/house_bills.json).
"""
import glob, json, os, re
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAW = re.compile(r"Approved by the President|Lapsed Into Law|Consolidated with Approved Bill|Republic Act", re.I)
PASSED = re.compile(r"Pending in the (House|Senate)|Passed by Both|Enrolled|Vetoed|Conference Committee|Conferees|Sent Back to|"
                    r"Approved by the (House|Senate)|Third Reading|transmitted", re.I)

out = {}
for f in sorted(glob.glob(os.path.join(ROOT, "data/billhist/*.json"))):
    pid = os.path.basename(f)[:-5]
    for r in json.load(open(f))["bills"]:
        c, ch, st = r[0], r[1], r[5]
        if c >= 20: continue
        x = out.setdefault(pid, {}).setdefault(ch, {}).setdefault(str(c), [0, 0, 0])
        law = bool(LAW.search(st))
        x[0] += 1; x[1] += law or bool(PASSED.search(st)); x[2] += law
meta = {"retrieved": date.today().isoformat(), "from": "data/billhist (BetterGov open-congress-data, 13th-19th Congress)",
        "note": "Bills where the lawmaker is listed as an author in the source (principal or co-author, as listed). [filed, passed their chamber, became law]."}
json.dump({"_meta": meta, "people": out}, open(os.path.join(ROOT, "data/billterms.json"), "w"), separators=(",", ":"))
print(f"{len(out)} lawmakers with bills before the 20th Congress")
