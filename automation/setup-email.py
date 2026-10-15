#!/usr/bin/env python3
"""Gheimatyar one-time transactional email setup.
Uses Resend, Cloudflare and Supabase REST APIs. No package installation, no
GitHub commits, and no writes to local credential files. Do not run as root.
"""
import getpass
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = "famgroupofficial.com"
DOMAIN = "send." + ROOT
PROJECT = "axmkjoscwgvkzrdguiig"
SITE = "https://jobemploy22-commits.github.io/gheimatyar-live-auction/"
LOGIN = SITE + "live.html"
SENDER = "no-reply@" + DOMAIN

class SetupError(Exception):
    pass

def api(method, url, token, payload=None):
    headers = {"Authorization": "Bearer " + token, "Accept": "application/json"}
    body = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, headers=headers, data=body, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            data = response.read(1500000)
            return json.loads(data) if data else {}
    except urllib.error.HTTPError as ex:
        try:
            raw = json.loads(ex.read(5000))
            info = raw.get("message") or raw.get("error") or "Request failed"
            if not isinstance(info, str):
                info = "Request failed"
        except (ValueError, UnicodeDecodeError, AttributeError):
            info = "Request failed"
        raise SetupError(f"{urllib.parse.urlsplit(url).hostname}: HTTP {ex.code}: {info[:180]}") from None
    except urllib.error.URLError:
        raise SetupError(f"Network error contacting {urllib.parse.urlsplit(url).hostname}") from None

def secret(label, prefix=None):
    value = getpass.getpass(label + ": ").strip()
    if not value or (prefix and not value.startswith(prefix)):
        raise SetupError(f"{label}: missing or invalid value")
    return value

def dns_name(short):
    name = str(short or "").strip().rstrip(".").lower()
    if name in ("", "@", DOMAIN):
        return DOMAIN
    if name.endswith("." + DOMAIN):
        return name
    if name == ROOT or name.endswith("." + ROOT):
        raise SetupError(f"Unsafe DNS record outside {DOMAIN}: {name}")
    return name + "." + DOMAIN

def normalized(kind, raw):
    value = str(raw or "").strip()
    if kind == "TXT" and value.startswith('"') and value.endswith('"'):
        value = value[1:-1]
    if kind in ("MX", "CNAME"):
        value = value.rstrip(".")
    return value

def domain_id(resend):
    result = api("GET", "https://api.resend.com/domains", resend)
    existing = next((d for d in result.get("data", []) if d.get("name") == DOMAIN), None)
    if existing:
        print("Resend: domain already exists")
        return existing["id"]
    print("Resend: creating " + DOMAIN)
    result = api("POST", "https://api.resend.com/domains", resend,
                 {"name": DOMAIN, "region": "eu-west-1"})
    if not result.get("id"):
        raise SetupError("Resend did not return a domain ID")
    return result["id"]

def dns_records(details):
    records = []
    for item in details.get("records", []):
        kind = str(item.get("type") or "").upper()
        if kind not in ("TXT", "MX", "CNAME"):
            continue
        record = {
            "type": kind,
            "name": dns_name(item.get("name")),
            "content": normalized(kind, item.get("value")),
            "ttl": 1,
        }
        if not record["content"]:
            raise SetupError(f"Missing record value for {record['name']}")
        if kind == "MX":
            record["priority"] = int(item.get("priority") or 10)
        if kind == "CNAME":
            record["proxied"] = False
        if record not in records:
            records.append(record)
    if not records:
        raise SetupError("No DNS records were returned by Resend")
    return records

def get_zone(cloudflare):
    qs = urllib.parse.urlencode({"name": ROOT, "per_page": "10"})
    result = api("GET", "https://api.cloudflare.com/client/v4/zones?" + qs, cloudflare)
    if result.get("success") is not True:
        raise SetupError("Cloudflare zone lookup failed")
    found = [x for x in result.get("result", []) if x.get("name") == ROOT]
    if len(found) != 1:
        raise SetupError("Cloudflare zone not found. Token needs Zone:Read and DNS:Edit on " + ROOT)
    return found[0]["id"]

def save_records(cloudflare, zone, records):
    url = f"https://api.cloudflare.com/client/v4/zones/{zone}/dns_records"
    for record in records:
        qs = urllib.parse.urlencode({"name": record["name"], "per_page": "100"})
        existing = api("GET", url + "?" + qs, cloudflare)
        if existing.get("success") is not True:
            raise SetupError("Cloudflare DNS list failed")
        entries = existing.get("result", [])
        for e in entries:
            if e.get("type") == record["type"] and (
                normalized(record["type"], e.get("content")) == record["content"]
            ):
                print(f"DNS exists: {record['type']} {record['name']}")
                break
        else:
            # Never overwrite existing values. Refuse conflicts instead of breaking mail.
            if record["type"] == "CNAME" and entries:
                raise SetupError("DNS CNAME conflict at " + record["name"])
            conflicts = [
                e for e in entries if e.get("type") == record["type"] and (
                    record["type"] == "MX" or
                    (record["type"] == "TXT" and
                     ("v=spf1" in record["content"].lower() or
                      "v=spf1" in str(e.get("content", "")).lower()))
                )
            ]
            if conflicts:
                raise SetupError("DNS record conflict at " + record["name"] + ". Nothing overwritten.")
            created = api("POST", url, cloudflare, record)
            if created.get("success") is not True:
                raise SetupError("Cloudflare refused new DNS record")
            print(f"DNS created: {record['type']} {record['name']}")

def verify_resend(resend, ident):
    root = "https://api.resend.com/domains/" + urllib.parse.quote(ident)
    state = api("GET", root, resend).get("status")
    if state == "verified":
        return True
    api("POST", root + "/verify", resend)
    for n in range(15):
        time.sleep(4)
        state = api("GET", root, resend).get("status")
        print(f"Checking DNS confirmation {n + 1}/15: {state}")
        if state == "verified":
            return True
        if state == "failed":
            break
    return False

def setup_supabase(token, resend):
    url = f"https://api.supabase.com/v1/projects/{PROJECT}/config/auth"
    current = api("GET", url, token)
    old_redirects = current.get("uri_allow_list") or ""
    if isinstance(old_redirects, str):
        old_redirects = [s.strip() for s in old_redirects.split(",") if s.strip()]
    if not isinstance(old_redirects, list):
        raise SetupError("Unexpected Supabase redirect config. Stopping to avoid overwriting it.")
    whitelist = list(dict.fromkeys(old_redirects + [SITE + "**", LOGIN, LOGIN + "?afterAuth=1"]))
    updates = {
        "site_url": SITE,
        "uri_allow_list": ",".join(whitelist),
        "external_email_enabled": True,
        "mailer_autoconfirm": False,
        "smtp_admin_email": SENDER,
        "smtp_host": "smtp.resend.com",
        "smtp_port": "465",
        "smtp_user": "resend",
        "smtp_pass": resend,
        "smtp_sender_name": "Gheimatyar",
    }
    api("PATCH", url, token, updates)
    print("Supabase SMTP and redirect settings updated; email verification remains enabled.")

def main():
    print("\n== Gheimatyar: automated email setup ==")
    print(f"Email domain: {DOMAIN}\nSupabase project: {PROJECT}")
    print("Only Resend, Cloudflare DNS for this subdomain, and this Supabase project are changed.")
    print("No server services, database rows, VPN or other projects are changed.")
    print("Credentials are entered in this terminal without displaying them or saving to files.\n")
    print("You will need:")
    print("  1. Resend full-access API key (re_...) from resend.com/api-keys")
    print("  2. Cloudflare token (Zone:Read and DNS:Edit ONLY on " + ROOT + ")")
    print("  3. Supabase personal access token from supabase.com/dashboard/account/tokens")
    if input("\nHave all 3 tokens ready? Type yes to continue: ").strip().lower() != "yes":
        print("No changes made.")
        return
    resend = secret("Resend API key", "re_")
    cloudflare = secret("Cloudflare limited API token")
    supabase = secret("Supabase personal access token")
    print("\nChecking email domain and DNS...")
    ident = domain_id(resend)
    details = api("GET", "https://api.resend.com/domains/" + ident, resend)
    records = dns_records(details)
    zone = get_zone(cloudflare)
    print("\nProposed DNS records (values hidden):")
    for r in records:
        print(f" {r['type']}  {r['name']}")
    if input("\nCreate missing DNS records? Type yes: ").strip().lower() != "yes":
        print("Cancelled before DNS and SMTP changes.")
        return
    save_records(cloudflare, zone, records)
    if not verify_resend(resend, ident):
        print("\nDNS created, but verification is still pending. Wait for DNS propagation and rerun.")
        print("Supabase SMTP has NOT been changed.")
        return
    print("Resend domain is verified.")
    setup_supabase(supabase, resend)
    print("\nDONE. Open " + LOGIN)
    print("Use Resend verification email for an existing unconfirmed account.")
    print("Keys were not saved.")

if __name__ == "__main__":
    try:
        main()
    except (SetupError, KeyboardInterrupt) as ex:
        print("\nSTOP: " + (str(ex) or "Cancelled"), file=sys.stderr)
        sys.exit(1)
