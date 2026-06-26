"""Guard test: every query against a tenant-owned table must filter by org_id.
This is the core multi-tenant isolation invariant — if a future route forgets
the org_id filter, this fails."""
import re
from pathlib import Path

ROUTES = Path(__file__).resolve().parents[1] / "app" / "routes"
TENANT_TABLES = ("research_reports", "watchlist", "audit_logs")


def test_all_tenant_queries_are_org_scoped():
    offenders = []
    for f in ROUTES.glob("*.py"):
        src = f.read_text()
        for m in re.finditer(
            r'\.table\("(%s)"\)(.*?)\.execute\(\)' % "|".join(TENANT_TABLES), src, re.S
        ):
            chain = m.group(2)
            if "org_id" not in chain:
                offenders.append(f"{f.name}: unscoped {m.group(1)} query")
    assert not offenders, offenders
