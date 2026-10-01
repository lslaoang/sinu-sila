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

print("\n".join(errors) or "ok")
sys.exit(bool(errors))
