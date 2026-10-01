# PH Officials Records

Static site of public records on Philippine officials. Rule: no record without a `source_url`.

- Data: `data/officials.json` (replace the SAMPLE entry with real, sourced records)
- Check: `python3 validate.py`
- Preview: `python3 -m http.server` then open http://localhost:8000
- Deploy: any static host (GitHub Pages, Netlify, Cloudflare Pages)

Before launch: have a Philippine lawyer review wording (cyber libel, RA 10173).
