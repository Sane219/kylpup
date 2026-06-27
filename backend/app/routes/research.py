"""Research CRUD + the AI research run. Every query is scoped by org_id
(tenant isolation) and single-resource ops filter by BOTH org_id AND id
(IDOR guard, per the Phase 1 security review)."""
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.core.auth import Tenant, get_current_tenant
from app.core.responses import ok
from app.models.schemas import ReportPatch, ResearchIn
from app.services.agent import run_research, stream_research
from app.services.db import db

router = APIRouter(prefix="/research", tags=["research"])


@router.post("", status_code=201)
async def create_research(body: ResearchIn, t: Tenant = Depends(get_current_tenant)):
    try:
        result = await run_research(body.query)
    except Exception as e:
        # AI/tool failure must not 500 the product — return a clear error
        raise HTTPException(503, f"research engine unavailable: {e}")
    row = db().table("research_reports").insert({
        "org_id": t.org_id, "user_id": t.user_id,
        "query": body.query, "result_json": result,
    }).execute().data[0]
    db().table("audit_logs").insert(
        {"org_id": t.org_id, "user_id": t.user_id, "action": "research.create",
         "meta": {"report_id": row["id"]}}).execute()
    return ok(row)


@router.post("/stream")
async def stream_research_run(body: ResearchIn, t: Tenant = Depends(get_current_tenant)):
    """Newline-delimited JSON stream of the agent run (plan, tool calls, synth),
    then persists the report and emits a final 'saved' event. Same org scoping
    as the non-streaming create."""
    async def gen():
        result = None
        try:
            async for ev in stream_research(body.query):
                if ev.get("type") == "result":
                    result = ev["result"]
                yield json.dumps(ev) + "\n"
            if result is not None:
                row = db().table("research_reports").insert({
                    "org_id": t.org_id, "user_id": t.user_id,
                    "query": body.query, "result_json": result,
                }).execute().data[0]
                db().table("audit_logs").insert(
                    {"org_id": t.org_id, "user_id": t.user_id,
                     "action": "research.create", "meta": {"report_id": row["id"]}}).execute()
                yield json.dumps({"type": "saved", "report": row}) + "\n"
        except Exception as e:
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")


@router.get("")
def list_research(t: Tenant = Depends(get_current_tenant),
                  q: str | None = Query(None, description="search in query text"),
                  tag: str | None = None):
    sel = db().table("research_reports").select(
        "id,query,tags,created_at").eq("org_id", t.org_id)
    if q:
        sel = sel.ilike("query", f"%{q}%")
    if tag:
        sel = sel.contains("tags", [tag])
    rows = sel.order("created_at", desc=True).execute().data
    return ok(rows)


@router.get("/{report_id}")
def get_research(report_id: str, t: Tenant = Depends(get_current_tenant)):
    rows = db().table("research_reports").select("*").eq(
        "org_id", t.org_id).eq("id", report_id).execute().data
    if not rows:
        raise HTTPException(404, "report not found")
    return ok(rows[0])


@router.patch("/{report_id}")
def update_research(report_id: str, body: ReportPatch,
                    t: Tenant = Depends(get_current_tenant)):
    patch = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not patch:
        raise HTTPException(400, "nothing to update")
    rows = db().table("research_reports").update(patch).eq(
        "org_id", t.org_id).eq("id", report_id).execute().data
    if not rows:
        raise HTTPException(404, "report not found")
    return ok(rows[0])


@router.delete("/{report_id}", status_code=204)
def delete_research(report_id: str, t: Tenant = Depends(get_current_tenant)):
    db().table("research_reports").delete().eq(
        "org_id", t.org_id).eq("id", report_id).execute()
    return None
