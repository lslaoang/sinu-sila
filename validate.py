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

print("\n".join(errors) or "ok")
sys.exit(bool(errors))
