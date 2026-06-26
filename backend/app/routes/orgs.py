"""Org management. Admins see the org's invite code + member list. Joining an
org happens at signup via the invite code (see auth.signup)."""
from fastapi import APIRouter, Depends

from app.core.auth import Tenant, get_current_tenant, require_role
from app.core.responses import ok
from app.services.db import db

router = APIRouter(prefix="/orgs", tags=["orgs"])


@router.get("/invite")
def invite_code(t: Tenant = Depends(require_role("admin"))):
    org = db().table("organizations").select("invite_code,name").eq(
        "id", t.org_id).single().execute().data
    return ok({"invite_code": org["invite_code"], "org_name": org["name"]})


@router.get("/members")
def members(t: Tenant = Depends(get_current_tenant)):
    rows = db().table("users").select("id,email,role,created_at").eq(
        "org_id", t.org_id).order("created_at").execute().data
    return ok(rows)
