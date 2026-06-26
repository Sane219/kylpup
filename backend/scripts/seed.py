"""Seed demo data: 2 orgs (Acme Capital, Beacon Partners), each with an admin +
an analyst, plus sample reports and a watchlist. Lets an evaluator log in and
see data + tenant isolation immediately.

  cd backend && python scripts/seed.py     (needs Supabase creds in .env)

Login with any printed email / password 'demo1234'.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import secrets  # noqa: E402
from app.services.db import db  # noqa: E402

PASSWORD = "demo1234"

ORGS = [
    {"name": "Acme Capital", "users": [("admin@acme.test", "admin"), ("analyst@acme.test", "analyst")]},
    {"name": "Beacon Partners", "users": [("admin@beacon.test", "admin"), ("analyst@beacon.test", "analyst")]},
]

SAMPLE_REPORT = {
    "summary": "Tesla shows revenue growth but compressing automotive margins amid price cuts; sentiment mixed.",
    "company_cards": [{"ticker": "TSLA", "name": "Tesla, Inc.", "price": 245.0,
                       "market_cap": 780000000000, "pe_ratio": 62.0, "eps": 3.9,
                       "highlight": "Energy segment growing", "citation": "yfinance"}],
    "comparison_table": {"columns": ["Metric", "TSLA"], "rows": [["P/E", "62.0"], ["EPS", "3.9"]]},
    "news_sentiment": [{"ticker": "TSLA", "title": "Tesla deliveries beat estimates",
                        "sentiment": "positive", "url": "https://example.com/tsla", "citation": "duckduckgo-news"}],
    "filing_insights": [{"ticker": "TSLA", "insight": "Cites lithium supply concentration as a risk.",
                         "citation": "TSLA 10K FY2023 — chunk 2"}],
    "risks": [{"ticker": "TSLA", "risk": "Automotive margin pressure from pricing.", "citation": "TSLA 10K FY2023"}],
    "sources_used": ["yfinance", "duckduckgo-news", "sec-filing-kb"],
}


def main():
    sb = db()
    for org in ORGS:
        org_row = sb.table("organizations").insert(
            {"name": org["name"], "invite_code": secrets.token_urlsafe(8)}).execute().data[0]
        print(f"\n{org['name']} (invite: {org_row['invite_code']})")
        first_uid = None
        for email, role in org["users"]:
            try:
                res = sb.auth.admin.create_user(
                    {"email": email, "password": PASSWORD, "email_confirm": True,
                     "app_metadata": {"org_id": org_row["id"], "role": role}})
                uid = res.user.id
            except Exception as e:
                print(f"  skip {email}: {e}"); continue
            sb.table("users").insert(
                {"id": uid, "org_id": org_row["id"], "email": email, "role": role}).execute()
            first_uid = first_uid or uid
            print(f"  {email} / {PASSWORD}  ({role})")
        # one sample report + watchlist per org (owned by the admin)
        if first_uid:
            sb.table("research_reports").insert(
                {"org_id": org_row["id"], "user_id": first_uid,
                 "query": "Quick overview of Tesla — performance, news, risks",
                 "result_json": SAMPLE_REPORT, "tags": ["Q3 Earnings"]}).execute()
            for tk in ("TSLA", "NVDA"):
                sb.table("watchlist").insert(
                    {"org_id": org_row["id"], "user_id": first_uid, "ticker": tk}).execute()
    print("\nseed complete — log in with any email above, password 'demo1234'")


if __name__ == "__main__":
    main()
