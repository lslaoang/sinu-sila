# Contributing to Sino Sila?

Thank you for helping. This project publishes records about real people, so accuracy and fairness come before speed.

## Report a factual error

- On the site: the **Report an error** button on any page (no account needed).
- On GitHub: [open a correction issue](https://github.com/lslaoang/ph-politicians/issues/new?template=correction.yml).

A link to the right source helps most. Officials and their staff are welcome to reply to any data point the same way.

## Rules for data

1. **Every record needs a source link** (`source_url`, or `sources` per case event). `python3 validate.py` must print
   `ok` before a pull request is merged.
2. **Prefer open, official or well-established sources.** Where BetterGov.ph already publishes the data openly, use it
   and credit it.
3. **Court cases** (`data/cases.json`):
   - two independent outlets, or one official court or Ombudsman page, per case;
   - neutral wording: "alleged" for charges; guilt only where a court or the Ombudsman decided;
   - record dismissals, acquittals, appeals and the person's own response alongside charges;
   - no private family or business disputes unless they became a public-office matter;
   - never mark someone as having "no cases" unless they were actually checked (`_meta.checked`).
4. **Don't copy data whose terms forbid it.** Link out instead (see how Pulitiklan is handled in `docs/data.md`).
5. **No personal data beyond public office**: no home addresses, private phone numbers or family members who are not
   public officials.

## Working on the code

- The site is one file, `index.html`, with no build step and no framework. Keep it that way: plain HTML, CSS and
  JavaScript, readable without tooling.
- Run it with `python3 -m http.server 8000` and check desktop, phone width, light and dark mode.
- Text appears in English and Filipino: add new strings to both the `en` and `fil` blocks of `T` in `index.html`.
- Accessibility basics: real buttons and links, labels on inputs, status never shown by colour alone.
- Keep pull requests small and focused, and describe what you checked.

## Python tools

Everything in `tools/` uses the Python standard library, except `mirror_photos.py` (needs Pillow). Scripts that call
other websites identify themselves with a descriptive User-Agent and wait between requests; keep it that way.

## Code of conduct

Be respectful and assume good faith. Political views are not on trial here; the record is. Harassment, doxxing and
personal attacks (including against officials) are not accepted in issues, pull requests or data.
