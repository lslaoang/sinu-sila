"""Receives the site's "Report an error" form and emails it to one address. The address lives only in the TO env var."""
import json, os, re, boto3

ses = boto3.client("ses", region_name=os.environ.get("SES_REGION", "ap-southeast-1"))
TO, ORIGIN = os.environ["TO"], os.environ["ORIGIN"]


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
    if not 10 <= len(msg) <= 2000 or not page.startswith(ORIGIN):
        return reply(400, "Please describe the problem in a sentence or two.")
    body = f"Page: {page}\n\nWhat is wrong:\n{msg}\n\nSource for the correction: {source or '-'}\nContact: {contact or '-'}\n"
    kw = {"ReplyToAddresses": [contact]} if re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", contact) else {}
    ses.send_email(Source=TO, Destination={"ToAddresses": [TO]}, ReplyToAddresses=kw.get("ReplyToAddresses", []),
                   Message={"Subject": {"Data": f"Sino Sila? correction: {page[-60:]}"}, "Body": {"Text": {"Data": body}}})
    return reply(200, "Thanks. We will look into it.")
