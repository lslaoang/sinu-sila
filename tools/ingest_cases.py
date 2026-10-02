"""Merge research-agent case reports into data/cases.json.

Usage: python3 tools/ingest_cases.py report1.json [report2.json ...]
Each report is a JSON array, one object per person (see the research prompt). The tool:
  - records every person as "checked" (so profiles can say "none found in sources checked");
  - appends cases that pass the same rules validate.py enforces (two independent outlets or an official
    court/Ombudsman source, ISO dates, enums, final statuses need a date); failures are printed, not saved;
  - writes "unconfirmed" notes to review/unconfirmed.json (git-ignored, never published).
Always read the result and spot-check the sources before committing: published cases name real people.
"""
import json, os, re, sys
from datetime import date

KINDS = {"criminal", "administrative", "election", "other"}
STATUSES = {"filed", "pending", "suspended", "appealed", "dismissed", "acquitted", "convicted", "decided"}
ROLES = {"accused", "respondent", "petitioner", "party"}
OFFICIAL = ("judiciary.gov.ph", "sandiganbayan.", "ombudsman.gov.ph", "lawphil.net", "comelec.gov.ph", "hret.", "set.gov.ph")
DATE = re.compile(r"\d{4}(-\d\d(-\d\d)?)?")
host = lambda u: re.sub(r"^https?://(www\.)?([^/]+).*", r"\2", u)


def problems(c):
    out = []
    if c.get("kind") not in KINDS: out.append(f"kind {c.get('kind')}")
    if c.get("status") not in STATUSES: out.append(f"status {c.get('status')}")
    if c.get("role") not in ROLES: out.append(f"role {c.get('role')}")
    if not c.get("title") or not c.get("body"): out.append("title/body missing")
    if c.get("status") in ("dismissed", "acquitted", "convicted", "decided") and not c.get("status_date"): out.append("final status needs status_date")
    hosts = set()
    if not c.get("events"): out.append("no events")
    for e in c.get("events", []):
        if not DATE.fullmatch(e.get("date", "")) or not e.get("text") or not e.get("sources"): out.append(f"bad event {e.get('date')}")
        for u in e.get("sources", []):
            if not str(u).startswith("http"): out.append(f"bad source {u}")
            hosts.add(host(u))
    if len(hosts) < 2 and not any(o in h for h in hosts for o in OFFICIAL): out.append("needs two independent outlets or an official source")
    return out


def main(paths):
    today = date.today().isoformat()
    data = json.load(open("data/cases.json"))
    ids = {o["id"] for o in json.load(open("data/officials.json"))} | {p["id"] for p in json.load(open("data/house.json"))["people"]}
    os.makedirs("review", exist_ok=True)
    rev = json.load(open("review/unconfirmed.json")) if os.path.exists("review/unconfirmed.json") else {}
    added = skipped = 0
    for path in paths:
        for obj in json.load(open(path)):
            pid = obj.get("id")
            if pid not in ids: print("UNKNOWN ID", pid); continue
            if obj.get("unconfirmed"): rev.setdefault(pid, []).extend(obj["unconfirmed"])
            if obj.get("notes"): rev.setdefault(pid + "#notes", []).append(obj["notes"])
            for c in obj.get("cases", []):
                bad = problems(c)
                if bad: print(f"REJECTED {pid}: {c.get('title', '')[:60]} -> {bad}"); skipped += 1; continue
                existing = data["cases"].setdefault(pid, [])
                if any(x["title"] == c["title"] for x in existing): continue
                c = {"id": f"{pid}-{len(existing) + 1}", **c}
                c["events"] = sorted(c["events"], key=lambda e: e["date"])
                existing.append(c); added += 1
            n = len([q for q in re.split(r";", obj.get("searched", "")) if q.strip()])
            data["_meta"]["checked"][pid] = {"date": today, "queries": n}
    data["cases"] = {k: v for k, v in data["cases"].items() if v}
    json.dump(data, open("data/cases.json", "w"), indent=1, ensure_ascii=False)
    json.dump(rev, open("review/unconfirmed.json", "w"), indent=1, ensure_ascii=False)
    print(f"added {added} cases, rejected {skipped}; checked now {len(data['_meta']['checked'])} people; people with cases {len(data['cases'])}")


main(sys.argv[1:])
