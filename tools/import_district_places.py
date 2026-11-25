"""Places (towns, cities or barangays) in each House district whose DPWH office also serves other districts.
Writes data/district_places.json so a profile can tell which district a project in a shared office's list is in.

  python3 tools/import_district_places.py

Source: the "towns" list in the infobox of each district's Wikipedia article ("Quezon City's 6th congressional district",
"Biñan's at-large congressional district"), CC BY-SA. Districts whose article has no list are reported and left out.
"""
import json, os, re, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "sinu-sila importer (+https://sinu-sila.com; https://github.com/lslaoang/sinu-sila)"}
ORD = lambda n: f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def wikitext(title):
    u = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({"action": "parse", "page": title, "prop": "wikitext", "format": "json", "formatversion": 2, "redirects": 1})
    for t in range(3):
        try:
            time.sleep(0.3)
            j = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40))
            return (j.get("parse") or {}).get("wikitext"), (j.get("parse") or {}).get("title")
        except Exception:
            time.sleep(2 * (t + 1))
    return None, None


def towns(w):
    m = re.search(r"\|\s*towns\s*=\s*", w or "")
    if not m: return []
    i, depth, j = m.end(), 0, m.end()
    while j < len(w):   # the value runs to the next "|field =" at brace depth 0 (a {{Collapsible list}} has its own "|" lines)
        if w.startswith("{{", j): depth += 1; j += 2; continue
        if w.startswith("}}", j):
            depth -= 1
            if depth < 0: break   # the infobox itself ended
            j += 2; continue
        if depth == 0 and w.startswith("\n|", j): break
        j += 1
    s = w[i:j]
    s = re.sub(r"\{\{\s*Collapsible list|\|\s*title(style)?\s*=[^\n|]*|\}\}", "\n", s, flags=re.I)
    s = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]+)\]\]", r"\1", s)
    s = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>|<[^>]+>|'''|''|\{\{[^}]*\}\}", "\n", s, flags=re.S)
    out = []
    for x in re.split(r"[\n,;•*|]", s):
        x = re.sub(r"\(.*?\)|^\s*(and|portion of|part of|north|south|east|west)\s+", "", x, flags=re.I).strip(" .")
        if not re.match(r"[A-ZÑ][\w'.\- ñÑ]{2,}$", x) or re.search(r"sq ?(km|mi)|vacant|^(Start|End)$", x, re.I): continue
        if x and not re.search(r"\d|barangay|municipalit|population|^(city|cities|towns|lgu)$|\[|\]|\{|\}|=", x, re.I) and len(x) < 40: out.append(x)
    return sorted(set(out))


house = {p["id"]: p for p in json.load(open(os.path.join(ROOT, "data/house.json")))["people"]}
budget = json.load(open(os.path.join(ROOT, "data/budget.json")))["districts"]
ids = [k for k, v in budget.items() if any(f.get("shared_with") for f in v.get("offices", []))]
out, missing = {}, []
for i in ids:
    p = house[i]; place = p["place"]
    names = [place, place.replace("City of ", ""), place.replace(" City", "")]
    titles = [f"{n}'s {ORD(p['district'])} congressional district" if p.get("district") else f"{n}'s at-large congressional district" for n in dict.fromkeys(names)]
    for t in titles:
        w, real = wikitext(t)
        got = towns(w)
        if got: out[i] = {"label": budget[i]["label"], "places": got, "source": "https://en.wikipedia.org/wiki/" + urllib.parse.quote(real.replace(" ", "_"))}; break
    else:
        if p["kind"] == "at-large":   # a lone district is the whole city: its name is the place
            out[i] = {"label": budget[i]["label"], "places": [place.replace("City of ", "").replace(" City", "")], "source": "the district is the whole city"}
        else: missing.append(f"{i} ({budget[i]['label']})")
meta = {"retrieved": time.strftime("%Y-%m-%d"), "source": "Wikipedia, each district article's list of towns or barangays (CC BY-SA 4.0)",
        "note": "Only districts whose DPWH office also serves other districts. Used to say which district a project's title names."}
json.dump({"_meta": meta, "districts": out}, open(os.path.join(ROOT, "data/district_places.json"), "w"), ensure_ascii=False, indent=1)
print(f"{len(out)} of {len(ids)} districts with a place list")
for m in missing: print("  no list:", m)
