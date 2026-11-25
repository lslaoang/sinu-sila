"""Fail the build if any record lacks a source link. Run: python3 validate.py"""
import json, os, sys

TYPES = {"bill", "vote", "saln", "campaign_finance", "audit", "case", "appointment", "membership"}
REC = {"type", "title", "date", "source_url", "retrieved"}
errors = []
seen = set()

for o in json.load(open("data/officials.json")):
    oid = o.get("id", "?")
    if oid in seen:
        errors.append(f"{oid}: duplicate id")
    seen.add(oid)
    for k in ("id", "name", "position", "records"):
        if k not in o:
            errors.append(f"{oid}: missing {k}")
    for i, r in enumerate(o.get("records", [])):
        if REC - r.keys():
            errors.append(f"{oid}[{i}]: missing {sorted(REC - r.keys())}")
        elif r["type"] not in TYPES:
            errors.append(f"{oid}[{i}]: bad type {r['type']}")
        elif not r["source_url"].startswith("http"):
            errors.append(f"{oid}[{i}]: source_url must be http(s)")

ids = {o["id"] for o in json.load(open("data/officials.json"))}
bills = json.load(open("data/bills.json"))
for k in bills:
    if k != "_meta" and k not in ids:
        errors.append(f"bills.json: unknown senator id {k}")
for k in ids - set(bills):
    errors.append(f"bills.json: no data for {k}")
for l in json.load(open("data/laws.json"))["bills"]:
    for role in ("author", "coAuthors", "coSponsors"):
        errors += [f"laws.json {l['no']}: unknown id {i}" for i in l[role] if i not in ids]
for o in json.load(open("data/officials.json")):
    if not (o.get("photo", "").startswith("assets/photos/") and os.path.exists(o["photo"])):
        errors.append(f"{o['id']}: missing photo")
    elif not o.get("photo_credit_url", "").startswith("https://commons.wikimedia.org/"):
        errors.append(f"{o['id']}: photo without a Commons credit link")

edu = json.load(open("data/education.json"))
for i in ids:
    if i not in edu:
        errors.append(f"education.json: no entry for {i}")
for k, items in edu.items():
    if k != "_meta" and k not in ids:
        errors.append(f"education.json: unknown id {k}")
    for it in items if k != "_meta" else []:
        if not all(u.startswith("http") for u in [it.get("source_url", "")] + it.get("more_sources", [])) or not it.get("school") or not it.get("level"):
            errors.append(f"education.json {k}: item missing school/level/source_url")

house = json.load(open("data/house.json"))["people"]
HREQ = {"id", "name", "body", "position", "constituency", "kind", "party", "term", "records"}
hseen = set(ids)
for p in house:
    pid = p.get("id", "?")
    if HREQ - p.keys():
        errors.append(f"house.json {pid}: missing {sorted(HREQ - p.keys())}")
    if pid in hseen:
        errors.append(f"house.json {pid}: duplicate id (also used by a senator or another member)")
    hseen.add(pid)
    if p.get("kind") not in ("district", "at-large", "party-list"):
        errors.append(f"house.json {pid}: bad kind {p.get('kind')}")
    for r in p.get("records", []):
        if REC - r.keys() or not r["source_url"].startswith("http"):
            errors.append(f"house.json {pid}: record missing fields or source_url")
    if p.get("photo") and not p.get("photo_credit_url", "").startswith("https://commons.wikimedia.org/"):
        errors.append(f"house.json {pid}: photo without a Commons credit link")

import os
if os.path.exists("data/pulitiklan.json"):
    for k, ls in json.load(open("data/pulitiklan.json"))["links"].items():
        if k not in hseen:
            errors.append(f"pulitiklan.json: unknown id {k}")
        errors += [f"pulitiklan.json {k}: bad url {l['url']}" for l in ls if not l["url"].startswith("https://pulitiklan.com/pamilya/")]

import re
OFFICIAL = ("judiciary.gov.ph", "sandiganbayan.", "ombudsman.gov.ph", "lawphil.net", "comelec.gov.ph", "hret.", "set.gov.ph")
KINDS = {"criminal", "administrative", "election", "other"}
STATUSES = {"filed", "pending", "suspended", "appealed", "dismissed", "acquitted", "convicted", "decided"}
ROLES = {"accused", "respondent", "petitioner", "party"}
cdata = json.load(open("data/cases.json"))
for k, ck in cdata["_meta"]["checked"].items():
    if not isinstance(ck, dict) or not ck.get("date"):
        errors.append(f"cases.json: checked entry {k} needs a date")
    if k not in hseen:
        errors.append(f"cases.json: checked id {k} unknown")
for k, cl in cdata["cases"].items():
    if k not in hseen:
        errors.append(f"cases.json: unknown id {k}")
    if k not in cdata["_meta"]["checked"]:
        errors.append(f"cases.json {k}: has cases but is not in _meta.checked")
    for c in cl:
        cid = c.get("id", "?")
        if c.get("kind") not in KINDS or c.get("status") not in STATUSES or c.get("role") not in ROLES:
            errors.append(f"cases.json {cid}: bad kind/status/role")
        if not c.get("title") or not c.get("body") or not c.get("events"):
            errors.append(f"cases.json {cid}: missing title/body/events")
        if c.get("status") in ("dismissed", "acquitted", "convicted", "decided") and not c.get("status_date"):
            errors.append(f"cases.json {cid}: final status needs status_date")
        hosts = set()
        for e in c.get("events", []):
            if not re.fullmatch(r"\d{4}(-\d\d(-\d\d)?)?", e.get("date", "")) or not e.get("text") or not e.get("sources"):
                errors.append(f"cases.json {cid}: event needs ISO date, text and sources")
            for u in e.get("sources", []):
                if not u.startswith("http"): errors.append(f"cases.json {cid}: bad source {u}")
                hosts.add(re.sub(r"^https?://(www\.)?([^/]+).*", r"\2", u))
        if len(hosts) < 2 and not any(any(o in h for o in OFFICIAL) for h in hosts):
            errors.append(f"cases.json {cid}: needs two independent outlets or an official court/Ombudsman source")

# SALN totals (tools/import_saln.py) and election results (tools/import_elections.py): optional files, but if present
# every SALN figure needs its own source link and every key must be a known person / party-list group
hids = {p["id"] for p in house}
if os.path.exists("data/saln.json"):
    for k, rs in json.load(open("data/saln.json"))["people"].items():
        if k not in ids: errors.append(f"saln.json: unknown senator id {k}")
        errors += [f"saln.json {k}: record without an http source_url" for r in rs if not str(r.get("source_url", "")).startswith("http")]
if os.path.exists("data/elections.json"):
    el = json.load(open("data/elections.json"))
    errors += [f"elections.json senate: unknown id {k}" for k in el["senate"] if k not in ids]
    errors += [f"elections.json house: unknown id {k}" for k in el["house"] if k not in hids]
    groups = {p["party"] for p in house if p.get("kind") == "party-list"}
    errors += [f"elections.json partylist: unknown group {k}" for k in el["partylist"] if k not in groups]
# district budget (tools/import_budget.py): keys are House district members, every link goes to BetterGov, Shared
# offices name the districts they also serve, and the "not evidence of wrongdoing" notice is kept
if os.path.exists("data/budget.json"):
    bd = json.load(open("data/budget.json"))
    if "wrongdoing" not in bd["_meta"].get("notice", ""): errors.append("budget.json: BetterGov's notice is missing")
    for k, d in bd["districts"].items():
        if k not in hids: errors.append(f"budget.json: unknown House id {k}")
        urls = [d["url"]] + [f["url"] for f in d["offices"]] + [p["url"] for p in d["top"]]
        errors += [f"budget.json {k}: link outside budget.bettergov.ph {u}" for u in urls if not u.startswith("https://budget.bettergov.ph/")]
        errors += [f"budget.json {k}: shared office {f['name']} without its other districts" for f in d["offices"] if f["tier"] == "B" and not f["shared_with"]]
        errors += [f"budget.json {k}: bad project group {p['g']}" for p in d["top"] if p["g"] not in ("house_only", "nep_only", "increased", "decreased")]
# House bill counts (tools/import_house_bills.py): known House ids, sane numbers (law <= passed <= filed, lead <= filed)
if os.path.exists("data/house_bills.json"):
    for k, v in json.load(open("data/house_bills.json"))["members"].items():
        if k not in hids: errors.append(f"house_bills.json: unknown House id {k}")
        f, lead, p, law = v
        if not (0 <= law <= p <= f and lead <= f): errors.append(f"house_bills.json {k}: counts out of order {v}")
# contacts (senate.gov.ph) and facts (Wikidata): known ids, emails look like emails, links are https
if os.path.exists("data/contacts.json"):
    cts = json.load(open("data/contacts.json"))
    for k, v in list(cts["senate"].items()) + list(cts.get("house", {}).items()):
        if k not in (ids if k in cts["senate"] else hids): errors.append(f"contacts.json: unknown id {k}")
        errors += [f"contacts.json {k}: bad email {e}" for _, e in v["emails"] if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[a-z]{2,}", e)]
        errors += [f"contacts.json {k}: bad link {u}" for u in v["web"] + v["social"] if not u.startswith("http")]
if os.path.exists("data/facts.json"):
    for k, v in json.load(open("data/facts.json"))["people"].items():
        if k not in ids | hids: errors.append(f"facts.json: unknown id {k}")
        if "born" in v and not re.fullmatch(r"\d{4}(-\d\d-\d\d)?", v["born"]): errors.append(f"facts.json {k}: bad date {v['born']}")
# bill history (tools/import_bill_history.py): one file per known lawmaker, sane rows, House-Senate pairs
import glob
for f in glob.glob("data/billhist/*.json"):
    k = os.path.basename(f)[:-5]
    if k not in ids | hids: errors.append(f"billhist: unknown lawmaker file {f}")
    for r in json.load(open(f))["bills"]:
        if len(r) != 8 or not (13 <= r[0] <= 20) or r[1] not in ("S", "H") or not re.fullmatch(r"(SBN|HBN)-\d+", str(r[2])) or (r[6] and not re.fullmatch(r"(SBN|HBN)-\d+", str(r[6]))):
            errors.append(f"{f}: bad row {r[:3]}"); break
if os.path.exists("data/bill_pairs.json"):
    for k, v in json.load(open("data/bill_pairs.json"))["pairs"].items():
        if not k.startswith("HBN-") or not str(v[0]).startswith("SBN-"): errors.append(f"bill_pairs.json: bad pair {k} {v}")
# per-term bill counts: known ids, [filed, passed, law] with law <= passed <= filed
if os.path.exists("data/billterms.json"):
    for k, v in json.load(open("data/billterms.json"))["people"].items():
        if k not in ids | hids: errors.append(f"billterms.json: unknown id {k}")
        for ch, ts in v.items():
            for c, (f, ps, lw) in ts.items():
                if ch not in ("S", "H") or not 8 <= int(c) <= 19 or not 0 <= lw <= ps <= f: errors.append(f"billterms.json {k}: bad {ch} {c} {[f, ps, lw]}")
# career (BetterGov Dynasties + open-congress-data): known ids, rows [year, position, place, won 1/0/null, votes, rank, party, path]
if os.path.exists("data/career.json"):
    for k, v in json.load(open("data/career.json"))["people"].items():
        if k not in ids | hids: errors.append(f"career.json: unknown id {k}")
        for r in v.get("races", []):
            if len(r) != 8 or not 2001 <= r[0] <= 2025 or r[3] not in (0, 1, None) or not r[7].startswith("/"): errors.append(f"career.json {k}: bad row {r}")
        for ch, ns in v.get("terms", {}).items():
            if ch not in ("house", "senate") or not all(8 <= n <= 20 for n in ns): errors.append(f"career.json {k}: bad terms {ch} {ns}")

print("\n".join(errors) or "ok")
sys.exit(bool(errors))
