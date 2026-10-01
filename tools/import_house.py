"""Import the House of Representatives roster from Wikipedia into data/house.json.

Run: python3 tools/import_house.py   (stdlib only; Wikipedia's API allows scripts with a descriptive User-Agent)
Every record cites the exact Wikipedia revision it came from. Treat the output as first-pass data:
cross-check each member against a second source before relying on it (see README).
"""
import json, re, sys, unicodedata, urllib.parse, urllib.request
from datetime import date, datetime
from html.parser import HTMLParser

PAGE = "List of current members of the House of Representatives of the Philippines"
UA = {"User-Agent": "ph-politicians/0.1 (contact: [removed])"}
TODAY = date.today().isoformat()


def fetch():
    q = urllib.parse.urlencode({"action": "parse", "page": PAGE, "prop": "text|revid", "format": "json"})
    d = json.load(urllib.request.urlopen(urllib.request.Request("https://en.wikipedia.org/w/api.php?" + q, headers=UA), timeout=40))
    return d["parse"]["revid"], d["parse"]["text"]["*"]


class Tables(HTMLParser):
    def __init__(s):
        super().__init__(); s.tables = []; s.cur = s.row = s.cell = None
    def handle_starttag(s, t, a):
        a = dict(a)
        if t == "table": s.cur = []
        elif s.cur is not None and t == "tr": s.row = []
        elif s.cur is not None and t in ("td", "th"): s.cell = {"t": "", "hrefs": [], "imgs": []}
        elif s.cell is not None and t == "a" and a.get("href", "").startswith("/wiki/") and ":" not in a["href"][6:]: s.cell["hrefs"].append(a["href"])
        elif s.cell is not None and t == "img": s.cell["imgs"].append(a.get("src", ""))
    def handle_data(s, x):
        if s.cell is not None: s.cell["t"] += x
    def handle_endtag(s, t):
        if t in ("td", "th") and s.cell is not None and s.row is not None: s.row.append(s.cell); s.cell = None
        elif t == "tr" and s.row is not None and s.cur is not None: s.cur.append(s.row); s.row = None
        elif t == "table" and s.cur is not None: s.tables.append(s.cur); s.cur = None


txt = lambda c: re.sub(r"\[[a-z0-9]+\]", "", re.sub(r"\s+", " ", c["t"])).strip()


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", re.sub(r'"[^"]*"', "", s.lower())).strip("-")


def constituency(c):
    c = c.replace("–", "–")
    if c.lower() == "party-list": return {"kind": "party-list", "place": None, "district": None, "label": "Party-list"}
    m = re.match(r"(.+?)\s+at-large$", c)
    if m: return {"kind": "at-large", "place": m.group(1), "district": None, "label": c}
    m = re.match(r"(.+?)–(\d+)\w*$", c)
    if m: return {"kind": "district", "place": m.group(1), "district": int(m.group(2)), "label": c}
    return {"kind": "district", "place": c, "district": None, "label": c}


def photo(cell):
    for src in cell["imgs"]:
        m = re.search(r"/wikipedia/commons/thumb/\w/\w\w/([^/]+)/\d+px-", src)
        if m:
            f = m.group(1)
            return (f"https://thumb.wikimedia.org/wikipedia/commons/thumb/{src.split('/thumb/')[1].split('/')[0]}/{src.split('/thumb/')[1].split('/')[1]}/{f}/250px-{f}",
                    "https://commons.wikimedia.org/wiki/File:" + f)
    return None, None


def main():
    revid, html = fetch()
    t = Tables(); t.feed(html)
    roster = max(t.tables, key=len)                       # the 300+ row member table
    src = f"https://en.wikipedia.org/w/index.php?title={urllib.parse.quote(PAGE.replace(' ', '_'))}&oldid={revid}"
    leaders = {}
    TITLES = {"Speaker of the House": "Speaker", "Senior Deputy Speaker": "Senior Deputy Speaker", "Deputy Speakers": "Deputy Speaker",
              "Majority Floor Leader": "Majority Floor Leader", "Minority Floor Leader": "Minority Floor Leader",
              "Senior Deputy Majority Floor Leader": "Senior Deputy Majority Floor Leader", "Senior Deputy Minority Floor Leader": "Senior Deputy Minority Floor Leader"}
    for tb in t.tables:                                    # Speaker, deputy speakers, floor leaders
        if tb and [txt(c) for c in tb[0]][:3] == ["Office", "Officer", "Constituency"]:
            office = None
            for r in tb[1:]:
                cells = [txt(c) for c in r]
                if len(r) >= 5: office, name = cells[0], cells[2]      # main row: office, portrait, name, party, constituency, since
                elif len(r) == 4: name = cells[1]                      # continuation row (rowspan): same office
                else: continue
                if office in TITLES: leaders.setdefault(name, TITLES[office])
    people, seen, vacant = [], set(), []
    for r in roster[1:]:
        if len(r) < 9:
            vacant.append(txt(r[0])); continue
        name, party, bloc, took = txt(r[2]), txt(r[4]), txt(r[5]), txt(r[8])
        if not name or "vacant" in name.lower():
            vacant.append(txt(r[0])); continue
        con = constituency(txt(r[0]))
        pid = slug(name)
        if pid in seen: pid = f"{pid}-{slug(con['label'])}"
        seen.add(pid)
        ph, credit = photo(r[1])
        try: since = datetime.strptime(took.split("(")[0].strip(), "%B %d, %Y").date().isoformat()
        except ValueError: since = None
        art = r[2]["hrefs"][0] if r[2]["hrefs"] else None
        p = {"id": pid, "name": name, "body": "house", "chamber": "House of Representatives", "position": leaders.get(name, "Representative"),
             "constituency": con["label"], "kind": con["kind"], "place": con["place"], "district": con["district"],
             "party": party, "bloc": bloc, "term": "20th Congress",
             "records": [{"type": "membership", "title": f"Representative, {con['label']}, 20th Congress", "date": since or "2025-06-30",
                          "source_url": src, "retrieved": TODAY}]}
        if art: p["wikipedia"] = "https://en.wikipedia.org" + art
        if ph: p["photo"], p["photo_credit_url"] = ph, credit
        people.append(p)
    people.sort(key=lambda p: (p["kind"] == "party-list", p["constituency"]))
    json.dump({"_meta": {"source": src, "retrieved": TODAY, "revid": revid, "vacant": vacant,
                         "note": "First-pass roster from Wikipedia; cross-check against a second source before relying on it."},
               "people": people}, open("data/house.json", "w"), indent=1, ensure_ascii=False)
    kinds = {k: sum(p["kind"] == k for p in people) for k in ("district", "at-large", "party-list")}
    print(len(people), "members", kinds, "vacant:", vacant, "photos:", sum("photo" in p for p in people), "leaders:", sum(p["position"] != "Representative" for p in people))


main()
