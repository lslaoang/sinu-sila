"""Receives the site's "Report an error" form: saves it to the corrections inbox (shown on /stats.html) and emails it.

The destination address lives only in the TO env var. Reports are stored in the STATS_TABLE DynamoDB table under the
partition d="reports" (sort key = time + random suffix), with status "new" until marked done on the dashboard.
"""
import json, os, re, secrets, boto3
from datetime import datetime, timedelta, timezone

ses = boto3.client("ses", region_name=os.environ.get("SES_REGION", "ap-southeast-1"))
TO = os.environ["TO"]
ORIGINS = tuple(o.strip() for o in os.environ["ORIGIN"].split(",") if o.strip())   # comma-separated: the domain and the CloudFront address
TABLE = os.environ.get("STATS_TABLE")
inbox = boto3.resource("dynamodb").Table(TABLE) if TABLE else None
PH = timezone(timedelta(hours=8))


def reply(code, msg):
    return {"statusCode": code, "headers": {"content-type": "application/json"}, "body": json.dumps({"ok": code == 200, "message": msg})}


def lambda_handler(event, _):
    try:
        d = json.loads(event.get("body") or "{}")
    except ValueError:
        return reply(400, "Bad request")
    if d.get("website"):                                   # honeypot: real visitors never fill this
        return reply(200, "Thanks")
    msg, page = str(d.get("message", "")).strip(), str(d.get("page", ""))[:300]
    contact, source = str(d.get("contact", "")).strip()[:200], str(d.get("source", "")).strip()[:300]
    if not 10 <= len(msg) <= 2000 or not page.startswith(ORIGINS):
        return reply(400, "Please describe the problem in a sentence or two.")
    saved = emailed = False
    if inbox:                                              # the inbox first, so a mail problem never loses a report
        try:
            now = datetime.now(PH)
            inbox.put_item(Item={"d": "reports", "k": f"{now.isoformat(timespec='seconds')}#{secrets.token_hex(3)}",
                                 "message": msg, "page": page, "source": source, "contact": contact, "status": "new"})
            saved = True
        except Exception as e:                             # still try the email
            print("inbox error:", repr(e))
    try:
        body = f"Page: {page}\n\nWhat is wrong:\n{msg}\n\nSource for the correction: {source or '-'}\nContact: {contact or '-'}\n"
        kw = {"ReplyToAddresses": [contact]} if re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", contact) else {}
        ses.send_email(Source=TO, Destination={"ToAddresses": [TO]}, ReplyToAddresses=kw.get("ReplyToAddresses", []),
                       Message={"Subject": {"Data": f"Sino Sila? correction: {page[-60:]}"}, "Body": {"Text": {"Data": body}}})
        emailed = True
    except Exception as e:
        print("email error:", repr(e))
    if not (saved or emailed):
        return reply(500, "Could not send. Please try again later.")
    return reply(200, "Thanks. We will look into it.")
