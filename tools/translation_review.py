"""Translation review by a native speaker, through a spreadsheet.

  python3 tools/translation_review.py export bcl ceb pam hil review/translation-review.xlsx
      one sheet per language: English, Filipino, the current draft, and an empty "Your correction" column.
      Court-case lines come first and are shaded: they decide how fairly a lawmaker is described.
  python3 tools/translation_review.py apply review/translation-review.xlsx --reviewer "Name" [--done bcl,ceb]
      copies every filled-in correction into i18n/<code>.json and adds the reviewer to "reviewed_by".
      --done names the languages the reviewer checked in full; those drop the site's "draft" note.

Needs openpyxl (pip install openpyxl) and Node.js to load the site's base translations.
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAMES = {"ceb": "Bisaya (Cebuano)", "ilo": "Ilokano", "hil": "Hiligaynon (Ilonggo)", "war": "Winaray", "bcl": "Bikol", "pam": "Kapampangan"}
CASE = re.compile(r"^(st_|tr_|m_|s_|k_|r_|cs|cg_)|^(hCases|meaningH|inShort|seeCases|tCases)$")
HOME = re.compile(r"^(title|kicker|h1|lede|search|tryL|where|pickPlace|glance|gDist|browse|b(Sen|House|PL)$|cta|your|facesAll|new|guideL|q[A-Z]|results|noResults|noMatch|showMore|skip|homeAl|nav|back|share|copied|topAl)")


def source_text():
    """Load the base translations and show placeholders where functions take values."""
    js = """
import {pathToFileURL} from 'node:url';
const {T} = await import(pathToFileURL(process.argv[1]));

function withPlaceholders(table) {
  return Object.fromEntries(Object.entries(table).map(([key, value]) => {
    if (typeof value !== 'function') return [key, value];
    try { return [key, String(value('{0}', '{1}', '{2}'))]; }
    catch { return [key, '']; }
  }));
}

console.log(JSON.stringify({en: withPlaceholders(T.en), fil: withPlaceholders(T.fil)}));
"""
    return json.loads(subprocess.check_output([
        "node", "--input-type=module", "-e", js, os.path.join(ROOT, "assets", "js", "messages.mjs"),
    ]))


def where(k):
    return "Court cases" if CASE.search(k) else "Home, menus, search" if HOME.search(k) else "Profiles and lists"


def export(codes, out):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    src = source_text()
    wb = Workbook()
    ws = wb.active; ws.title = "Read me"
    for row in [["Sino Sila? translation review"], [],
                ["Thank you for checking these translations. Each language has its own sheet."],
                ["Column E is the current draft. If it reads wrong or unnatural, write a better version in column F."],
                ["Leave column F empty when the draft is already right."],
                ["Keep {0} and {1} as they are: the site puts a number or a name there. Keep <mark> and </mark> too."],
                ["The shaded rows at the top are about court cases. Please check them most carefully:"],
                ["a case or complaint is only an allegation until a court decides it, and the words must keep that meaning."],
                ["Use column G for anything you are unsure about, or a question for us."], [],
                ["Salamat sa pagsuri! Isulat sa column F ang mas tamang salin. Iwanang blangko kung tama na."]]:
        ws.append(row)
    ws["A1"].font = Font(bold=True, size=14); ws.column_dimensions["A"].width = 110
    gold = PatternFill("solid", fgColor="F3E6C4")
    for code in codes:
        d = json.load(open(os.path.join(ROOT, f"i18n/{code}.json")))
        s = wb.create_sheet(NAMES[code][:31])
        s.append(["Key (do not change)", "Where on the site", "English", "Filipino", f"Draft in {NAMES[code]}", "Your correction", "Notes"])
        keys = sorted((k for k in d if not k.startswith("_")), key=lambda k: (where(k) != "Court cases", where(k) != "Home, menus, search", list(d).index(k)))
        for k in keys + ["_draft", "_fix"]:
            en = src["en"].get(k, "Note shown on every page while the translation is a draft" if k == "_draft" else "Link text: fix the translation" if k == "_fix" else "")
            s.append([k, "Draft note" if k.startswith("_") else where(k), en, src["fil"].get(k, ""), d.get(k, ""), "", ""])
            if where(k) == "Court cases": [setattr(c, "fill", gold) for c in s[s.max_row]]
        for col, w in zip("ABCDEFG", (16, 18, 42, 42, 42, 42, 28)): s.column_dimensions[col].width = w
        for r in s.iter_rows():
            for c in r: c.alignment = Alignment(wrap_text=True, vertical="top")
        for c in s[1]: c.font = Font(bold=True)
        s.freeze_panes = "C2"
    wb.save(out)
    print(f"wrote {out}: {', '.join(NAMES[c] for c in codes)}")


def apply(path, reviewer, done):
    from openpyxl import load_workbook
    wb = load_workbook(path)
    by_name = {v[:31]: k for k, v in NAMES.items()}
    for s in wb.worksheets:
        code = by_name.get(s.title)
        if not code: continue
        f = os.path.join(ROOT, f"i18n/{code}.json"); d = json.load(open(f)); n = 0
        for key, _, _, _, draft, fix, note in s.iter_rows(min_row=2, max_col=7, values_only=True):
            fix = (fix or "").strip()
            if not key or not fix or fix == (d.get(key) or "").strip(): continue
            ph = lambda x: sorted(re.findall(r"\{\d\}", x or "")) + [x.count("<mark>") if x else 0]
            if ph(fix) != ph(draft): print(f"  {code} {key}: skipped, {{0}}/<mark> differ from the draft: {fix!r}"); continue
            d[key] = fix; n += 1
        if reviewer and (n or code in done) and reviewer not in d["_meta"]["reviewed_by"]: d["_meta"]["reviewed_by"].append(reviewer)
        if code in done: d["_meta"].update(status="reviewed by a native speaker", reviewed=True)
        json.dump(d, open(f, "w"), ensure_ascii=False, indent=1)
        print(f"{NAMES[code]}: {n} corrections applied" + (", marked reviewed" if code in done else ""))


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["export"] and len(a) >= 3: export(a[1:-1], a[-1])
    elif a[:1] == ["apply"] and len(a) >= 2: apply(a[1], a[a.index("--reviewer") + 1] if "--reviewer" in a else "", a[a.index("--done") + 1].split(",") if "--done" in a else [])
    else: sys.exit(__doc__)
