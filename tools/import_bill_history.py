"""Every bill each lawmaker authored, by Congress, with the other chamber's version where a record names it.
Writes data/billhist/<id>.json (one per lawmaker) and data/bill_pairs.json.

  python3 tools/import_bill_history.py --print-js
      snippet for a senate.gov.ph tab (tools/senate_history.js): the 20th Congress Senate bills and their House versions
  python3 tools/import_bill_history.py --ocd <open-congress-data clone> --senate20 <sinosila-senate-20th.json>

Sources:
  13th-19th Congress, both chambers: BetterGov open-congress-data (https://github.com/bettergovph/open-congress-data, CC0),
    matched to our lawmakers by their Senate and House member codes; the other chamber's version is the bill number
    the record's history names most often.
  20th Congress: senate.gov.ph (the snippet above) for senators; BatasWatch (bills.juris.ph, CC0) for House members.
Row: [congress, "S"|"H", bill no, title, filed, status, other chamber's version or "", url]
"""
import glob, html, json, os, re, sys, time, tomllib, urllib.request
from collections import Counter
from datetime import date, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, *p)
officials = json.load(open(D("data/officials.json")))
house = json.load(open(D("data/house.json")))["people"]
CYR = str.maketrans("АВСЕНКМОРТХІаеорсхуі", "ABCEHKMOPTXIaeopcxyi")
clean = lambda t: re.sub(r"\s+", " ", html.unescape(t or "").replace('\\"', '"').translate(CYR)).strip()   # some titles carry escaped quotes
arg = lambda f: sys.argv[sys.argv.index(f) + 1] if f in sys.argv else None

if "--print-js" in sys.argv:
    js = open(D("tools/senate_history.js")).read()
    print(f"({js[js.index('*/') + 2:].strip()})({json.dumps({o['id']: o['lis_codes'] for o in officials}, separators=(',', ':'))}); 'started'")
    sys.exit()
if not (arg("--ocd") and arg("--senate20")): sys.exit(__doc__)
ocd = arg("--ocd")

# ---- who is who: our ids by Senate code and House member code ----
official = json.load(open(D("data/house_bills.json")))["official"]
by_hcode = {v.rsplit("/", 1)[1]: k for k, v in official.items()}
by_scode = {c: o["id"] for o in officials for c in o["lis_codes"]}
person = {}   # open-congress-data person id -> our id
for f in glob.glob(f"{ocd}/data/person/*.toml"):
    p = tomllib.load(open(f, "rb"))
    ids = {by_hcode[k] for k in p.get("congress_website_author_keys", []) if k in by_hcode} | {by_scode[k] for k in p.get("senate_website_keys", []) if k in by_scode}
    if len(ids) == 1: person[p["id"]] = ids.pop()
s_of = {}   # Senate code -> our id (any Congress); House code -> our id
h_of = {}
for f in glob.glob(f"{ocd}/data/person/*.toml"):
    p = tomllib.load(open(f, "rb"))
    if p["id"] not in person: continue
    for k in p.get("senate_website_keys", []): s_of[k] = person[p["id"]]
    for k in p.get("congress_website_author_keys", []): h_of[str(k)] = person[p["id"]]

out = {}
add = lambda pid, row: out.setdefault(pid, []).append(row)
num = lambda s: int(re.sub(r"\D", "", str(s)) or 0)

def other(history, kind):
    """The other chamber's bill number the record's history names most often ('in substitution of' lists are skipped)."""
    pat = r"\bHBN?\.?\s?-?\s?0*(\d{1,5})" if kind == "H" else r"\bSBN?\.?\s?-?\s?0*(\d{1,5})"
    hits = []
    for h in history or []:
        a = re.split(r"in substitution of", h.get("action", ""), flags=re.I)[0]
        hits += re.findall(pat, a)
    if not hits: return ""
    n = Counter(hits).most_common(1)[0][0]
    return f"{'HBN' if kind == 'H' else 'SBN'}-{int(n)}"

# ---- 13th to 19th Congress: open-congress-data ----
for sub in ("sb", "hb"):
    for c in range(13, 20):
        for f in glob.glob(f"{ocd}/data/document/{sub}/{c}/*.toml"):
            d = tomllib.load(open(f, "rb")); m = d.get("meta", {})
            codes = m.get("senate_website_author_codes" if sub == "sb" else "congress_website_author_codes") or []
            who = {(s_of if sub == "sb" else h_of).get(str(k)) for k in codes} - {None}
            if not who: continue
            st = (d.get("status") or [{}])[-1].get("status", "")
            no = f"{'SBN' if sub == 'sb' else 'HBN'}-{m.get('bill_number')}"
            url = m.get("ldr_website_permalink") or m.get("senate_website_permalink") or (m.get("download_url_sources") or [""])[-1]
            row = [c, sub[0].upper(), no, clean(m.get("title") or m.get("congress_website_title") or m.get("long_title")), str(m.get("date_filed") or ""), st,
                   other(d.get("history"), "H" if sub == "sb" else "S"), url]
            for pid in who: add(pid, row)

# ---- 20th Congress, Senate: senate.gov.ph ----
s20 = json.load(open(arg("--senate20")))
pairs, seen = {}, set()
for sid, c, no, t, filed, st, bid in s20["rows"]:
    if (sid, bid) in seen: continue
    seen.add((sid, bid))
    try: filed = datetime.strptime(filed.strip(), "%B %d, %Y").date().isoformat()
    except ValueError: pass
    cp = s20["cp"].get(bid, "")
    add(sid, [20, "S", no, clean(t), filed, st.strip(), cp, f"https://senate.gov.ph/legislative-documents/bills/{bid}"])
    if cp: pairs[cp] = [no, bid]

# ---- 20th Congress, House: BatasWatch ----
UA = {"User-Agent": "sinu-sila importer (+https://sinu-sila.com; https://github.com/lslaoang/sinu-sila)"}
def bw(path):
    for i in range(4):
        try: time.sleep(0.2); return json.load(urllib.request.urlopen(urllib.request.Request("https://bills.juris.ph/api" + path, headers=UA), timeout=90))
        except Exception:
            if i == 3: raise
            time.sleep(3 * (i + 1))
canon, authors = {}, bw("/authors?congress=20&chamber=house&per_page=500")["items"]   # BatasWatch author name -> our id
hbills, page = [], 1
while True:
    r = bw(f"/measures?congress=20&chamber=house&sort=latest&per_page=100&page={page}")
    hbills += r["items"]
    if page * 100 >= r["meta"]["total"]: break
    page += 1
names = {n for b in hbills for n in (b.get("primaryAuthors") or [])}
low = lambda x: re.sub(r'"[^"]*"', "", x).replace(".", " ").upper().split()
for a in authors:
    pid = by_hcode.get(a.get("officialMemberId"))
    if not pid: continue
    if a["canonicalName"] in names: canon[a["canonicalName"]] = pid; continue
    # the profile name can differ from the name printed on bills ("CRUZ, AGATHA PAULA AGUILAR" vs 'CRUZ, AGATHA "Agay"')
    sur, given = (a["canonicalName"].split(",", 1) + [""])[:2]
    for n in names:
        if n.split(",")[0].strip().upper() == sur.strip().upper() and set(low(given)) & set(low(n.split(",", 1)[-1])): canon[n] = pid
for b in hbills:
    no = f"HBN-{num(b['number'])}"
    sv = pairs.get(no)
    for n in b.get("primaryAuthors") or []:
        if n in canon:
            add(canon[n], [20, "H", no, clean(b["title"]), b.get("filedAt") or "", b.get("status") or "", sv[0] if sv else "",
                           f"https://bills.juris.ph/bills/house/{b['number'].lower()}"])

# ---- checks and write ----
bills = json.load(open(D("data/bills.json")))
missing = [o["id"] for o in officials if bills.get(o["id"], {}).get("total") and not any(r[0] == 20 for r in out.get(o["id"], []))]
if missing: sys.exit(f"no 20th Congress Senate bills for {missing}; not writing")
os.makedirs(D("data/billhist"), exist_ok=True)
for f in glob.glob(D("data/billhist/*.json")): os.remove(f)
meta = {"retrieved": date.today().isoformat(), "senate20": s20.get("retrieved"),
        "sources": ["https://github.com/bettergovph/open-congress-data", "https://senate.gov.ph", "https://bills.juris.ph"],
        "note": "Bills where the lawmaker is listed as author. 13th-19th Congress from BetterGov open-congress-data; 20th from senate.gov.ph and BatasWatch."}
total = 0
for pid, rows in out.items():
    uniq = {(r[0], r[2]): r for r in rows}   # one row per bill
    rows = sorted(uniq.values(), key=lambda r: (r[0], r[4], num(r[2])), reverse=True)
    total += len(rows)
    json.dump({"_meta": meta, "bills": rows}, open(D(f"data/billhist/{pid}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
json.dump({"_meta": {**meta, "note": "20th Congress House bill -> [Senate bill, senate.gov.ph id], from Senate bill histories."}, "pairs": dict(sorted(pairs.items()))},
          open(D("data/bill_pairs.json"), "w"), ensure_ascii=False, separators=(",", ":"))
size = sum(os.path.getsize(f) for f in glob.glob(D("data/billhist/*.json")))
print(f"{len(out)} lawmakers, {total} bills ({size // 1024} KB), {len(pairs)} 20th Congress pairs; {sum(1 for r in sum(out.values(), []) if r[6])} rows name the other chamber's version")
