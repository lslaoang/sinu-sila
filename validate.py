"""Fail the build if any record lacks a source link. Run: python3 validate.py"""
import json, sys

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
    if not o.get("photo", "").startswith("https://senate.gov.ph/"):
        errors.append(f"{o['id']}: missing photo")

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

print("\n".join(errors) or "ok")
sys.exit(bool(errors))
