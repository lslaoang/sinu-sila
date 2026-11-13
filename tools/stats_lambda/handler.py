"""Privacy-first visit counter for sinu-sila.com. Daily totals only: no cookies, no IP addresses, no visitor IDs.

POST /e        body {"p": "<route>", "r": "<referrer>", "n": 1 if first page of the tab session, "l": "en"|"fil"}
               -> adds 1 to today's counters (views, visits, page, referrer host, country, device, language)
GET  /e/stats?days=30  header x-stats-key: <STATS_KEY>  -> the counters for the last N days (the dashboard reads this)

Country and device come from CloudFront's own headers (CloudFront-Viewer-Country, CloudFront-Is-*-Viewer).
Table: STATS_TABLE (pk "d" = YYYY-MM-DD, sk "k" = "views" | "visits" | "page#senado" | "ref#facebook.com" | ...).
"""
import base64, json, os, re, hmac
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
import boto3
from boto3.dynamodb.conditions import Key

T = boto3.resource("dynamodb").Table(os.environ["STATS_TABLE"])
KEY = os.environ["STATS_KEY"]
PH = timezone(timedelta(hours=8))                       # days roll over at Manila midnight
BOT = re.compile(r"bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python|headless|lighthouse", re.I)
OWN = {"sinu-sila.com", "www.sinu-sila.com", "d3kbf1pju0ogt8.cloudfront.net"}


def out(code, body=None):
    return {"statusCode": code, "headers": {"content-type": "application/json", "cache-control": "no-store"}, "body": json.dumps(body or {})}


def clip(s, n=60):
    return re.sub(r"[^\w\-.:#/@]", "", str(s or ""))[:n]


def hit(event):
    h = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    if BOT.search(h.get("user-agent", "")): return out(204)
    raw = event.get("body") or "{}"
    try: b = json.loads(base64.b64decode(raw) if event.get("isBase64Encoded") else raw)   # function URLs base64 some content types
    except ValueError: return out(400)
    if not isinstance(b, dict): return out(400)
    page = clip(b.get("p") or "home") or "home"
    ref = urlparse(str(b.get("r") or "")).hostname or ""
    ref = "direct" if not ref or ref in OWN else re.sub(r"^(www\.|m\.|l\.|lm\.)", "", ref)[:60]
    dev = "mobile" if h.get("cloudfront-is-mobile-viewer") == "true" else "tablet" if h.get("cloudfront-is-tablet-viewer") == "true" else "desktop"
    country = clip(h.get("cloudfront-viewer-country") or "??", 2).upper() or "??"
    lang = "fil" if b.get("l") == "fil" else "en"
    day = datetime.now(PH).strftime("%Y-%m-%d")
    keys = ["views", f"page#{page}"]
    if b.get("n"): keys += ["visits", f"ref#{ref}", f"country#{country}", f"device#{dev}", f"lang#{lang}"]   # per visit, not per page
    for k in keys:
        T.update_item(Key={"d": day, "k": k}, UpdateExpression="ADD n :one", ExpressionAttributeValues={":one": 1})
    return out(204)


def stats(event):
    h = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    if not hmac.compare_digest(h.get("x-stats-key", ""), KEY): return out(401, {"error": "bad key"})
    q = event.get("queryStringParameters") or {}
    days = max(1, min(366, int(q.get("days", "30")) if str(q.get("days", "30")).isdigit() else 30))
    today = datetime.now(PH).date()
    rows = {}
    for i in range(days):
        d = (today - timedelta(days=i)).isoformat()
        items = T.query(KeyConditionExpression=Key("d").eq(d))["Items"]
        rows[d] = {it["k"]: int(it["n"]) for it in items}
    return out(200, {"days": rows, "generated": datetime.now(PH).isoformat(timespec="seconds")})


def lambda_handler(event, _):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path = event.get("rawPath", "")
    if method == "POST" and path.rstrip("/").endswith("/e"): return hit(event)
    if method == "GET" and path.rstrip("/").endswith("/e/stats"): return stats(event)
    return out(404)
