"""Build outbound links from our people to pulitiklan.com family pages.

Run: python3 tools/link_pulitiklan.py
Method: read Pulitiklan's published sitemap (robots.txt allows it) and match a person's surname (and, for House
members, their province/city) against the /pamilya/<place>/<family> URLs. Only URLs are stored, no Pulitiklan content.
Each candidate page is then fetched once (0.4 s apart) and kept only if the person's name appears on it. The page text is
used for that check and discarded; only the URL is stored. Pulitiklan has no stated reuse terms: do not copy its text or
data (see README). A listed name means Pulitiklan documents this person in that family, still worth a human glance.
"""
import collections, html, json, re, time, unicodedata, urllib.request
from datetime import date

UA = {"User-Agent": "ph-politicians/0.1 (contact: [removed])"}
SITEMAP = "https://pulitiklan.com/sitemap.xml"
SUFFIX = {"jr", "sr", "ii", "iii", "iv"}


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", re.sub(r'"[^"]*"', "", s)).strip("-")


def surname(name):
    w = [x for x in re.sub(r'"[^"]*"', "", name).split() if x.strip(".").lower() not in SUFFIX]
    return slug(w[-1]) if w else ""


_cache = {}
def page_text(u):
    if u not in _cache:
        time.sleep(0.4)
        try: raw = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=25).read().decode()
        except Exception: raw = ""
        _cache[u] = slug(html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<(script|style)[\s\S]*?</\1>", "", raw))))
    return _cache[u]


def listed(person, u):
    """True if the person's surname and a given name or nickname appear on the family page."""
    t = "-" + page_text(u) + "-"
    raw = person["name"]
    nick = re.findall(r'"([^"]+)"', raw)
    given = [slug(w) for w in re.sub(r'"[^"]*"', "", raw).split()[:-1] if slug(w) and slug(w).strip("-") not in SUFFIX and len(slug(w)) > 2 and not re.fullmatch(r"[a-z]\.?", w.lower())]
    sn = surname(raw)
    return f"-{sn}-" in t and any(f"-{g}-" in t for g in given + [slug(n) for n in nick])


def main():
    urls = re.findall(r"<loc>([^<]+)</loc>", urllib.request.urlopen(urllib.request.Request(SITEMAP, headers=UA), timeout=30).read().decode())
    by_place, by_family = collections.defaultdict(list), collections.defaultdict(list)
    for u in urls:
        m = re.match(r"https://pulitiklan\.com/pamilya/([^/]+)/([^/]+)$", u)
        if m: by_place[m.group(1)].append((m.group(2), u)); by_family[m.group(2)].append((m.group(1), u))
    has = lambda fam, s: f"-{s}-" in f"-{fam}-"
    senate = json.load(open("data/officials.json"))
    house = json.load(open("data/house.json"))["people"]
    links = {}
    for p in house:                                        # exact place + surname
        if not p.get("place"): continue
        s = surname(p["name"])
        hits = [u for f, u in by_place.get(slug(p["place"]), []) if has(f, s)]
        hits = [u for u in hits if listed(p, u)]
        if hits: links[p["id"]] = [{"url": u, "place": p["place"]} for u in hits]
    for p in senate:                                       # senators are nationwide: surname only, skip if ambiguous
        s = surname(p["name"])
        hits = [(pl, u) for f, lst in by_family.items() if has(f, s) for pl, u in lst]
        hits = [(pl, u) for pl, u in hits if listed(p, u)]
        if hits: links[p["id"]] = [{"url": u, "place": pl.replace("-", " ").title()} for pl, u in hits]
    json.dump({"_meta": {"source": SITEMAP, "retrieved": date.today().isoformat(),
                         "method": "Surname (and place) URL match, kept only if the person's name appears on that family page; only URLs stored, no Pulitiklan content copied"},
               "links": links}, open("data/pulitiklan.json", "w"), indent=1, ensure_ascii=False)
    print(len(links), "people linked;", sum(1 for p in house if p["id"] in links), "House,", sum(1 for p in senate if p["id"] in links), "Senate")


main()
