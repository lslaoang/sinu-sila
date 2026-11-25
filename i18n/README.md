# Translations

Sino Sila? is in English and Filipino. These files add local languages. They are **drafts**: machine-assisted and
not yet checked by a native speaker, and the site says so on every page shown in them.

| File | Language |
|---|---|
| `ceb.json` | Bisaya (Cebuano) |
| `ilo.json` | Ilokano |
| `hil.json` | Hiligaynon (Ilonggo) |
| `war.json` | Winaray |
| `bcl.json` | Bikol (Central Bikol) |
| `pam.json` | Kapampangan |

## Review by spreadsheet (easiest for reviewers)

`python3 tools/translation_review.py export bcl ceb pam hil review/sinosila-translation-review.xlsx` makes a
workbook with one sheet per language: English, Filipino, the draft, and an empty "Your correction" column, with
the court-case lines first. When it comes back, `python3 tools/translation_review.py apply <file> --reviewer "Name"
--done bcl,ceb` copies the corrections in (skipping any that drop `{0}` or `<mark>`) and, for the languages listed
after `--done`, marks them reviewed so the site stops showing the draft note. Check the diff, run `validate.py`,
then publish.

## How to help

If you speak one of these languages, please check its file and fix what reads wrong or unnatural. Open a pull
request on GitHub, or send the corrections through "Report an error" on the site.

- Each line is `"key": "text"`. Change only the text, never the key.
- Keep `{0}` and `{1}` exactly as they are: the site puts a number or a name there.
- Keep any HTML in the text, such as `<mark>…</mark>`.
- Court-case words matter most: `st_*` (a case's status), `tr_*`, `m_*` and `s_*` (what a case record means). A
  case or complaint is an allegation until a court decides it; please keep that meaning exact.
- Add your name (or a handle) to `"reviewed_by"` in `_meta` when you have checked the whole file. Once a native
  speaker has reviewed it, change `"status"` and the `_draft` line shown on the site.

Anything a file does not have yet shows in Filipino. To translate more of the site, copy a key and its Filipino
text from `const T` → `fil` in `assets/js/messages.mjs` into the file and translate it. Plain text only: keys whose Filipino
value is a function can take a string with `{0}`, `{1}` in place of the values.
