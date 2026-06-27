"""Signup/login/logout. Signup either creates a new org (caller becomes admin)
or joins an existing org via invite_code (caller becomes analyst). org_id+role
are written to the user's app_metadata so they ride inside the JWT."""
import secrets

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import Tenant, get_current_tenant
from app.core.responses import ok
from app.models.schemas import LoginIn, SignupIn
from app.services.db import auth_client, db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", status_code=201)
def signup(body: SignupIn):
    if bool(body.org_name) == bool(body.invite_code):
        raise HTTPException(400, "provide exactly one of org_name or invite_code")

    sb = db()
    # 1) resolve org + role first (cheap to fail before creating an auth user)
    if body.org_name:
        org = sb.table("organizations").insert(
            {"name": body.org_name, "invite_code": secrets.token_urlsafe(8)}
        ).execute().data[0]
        role = "admin"
    else:
        found = sb.table("organizations").select("*").eq(
            "invite_code", body.invite_code).execute().data
        if not found:
            raise HTTPException(404, "invalid invite code")
        org, role = found[0], "analyst"

    # 2) create the auth user. If this fails (e.g. duplicate email) and we just
    # created a fresh org, roll it back so we don't leave an orphan org.
    try:
        res = sb.auth.admin.create_user(
            {"email": body.email, "password": body.password, "email_confirm": True,
             "app_metadata": {"org_id": org["id"], "role": role}}
        )
        uid = res.user.id
    except Exception as e:
        if body.org_name:
            sb.table("organizations").delete().eq("id", org["id"]).execute()
        raise HTTPException(409, f"could not create user: {e}")

    # 3) mirror into our users table (org-scoped queries read from here)
    sb.table("users").insert(
        {"id": uid, "org_id": org["id"], "email": body.email, "role": role}
    ).execute()
    sb.table("audit_logs").insert(
        {"org_id": org["id"], "user_id": uid, "action": "signup", "meta": {"role": role}}
    ).execute()

    return ok({"user_id": uid, "org_id": org["id"], "role": role,
               "invite_code": org["invite_code"] if role == "admin" else None})


@router.post("/login")
def login(body: LoginIn):
    try:
        # fresh client: signing in mutates the client's auth session, so we must
        # NOT do it on the shared service-role client (see db() / auth_client()).
        res = auth_client().auth.sign_in_with_password(
            {"email": body.email, "password": body.password})
    except Exception:
        raise HTTPException(401, "invalid credentials")
    if not res.session:
        raise HTTPException(401, "invalid credentials")
    return ok({"access_token": res.session.access_token,
               "refresh_token": res.session.refresh_token,
               "token_type": "bearer"})


@router.post("/logout")
def logout(t: Tenant = Depends(get_current_tenant)):
    # Stateless JWT: client drops the token. Recorded for the audit trail.
    db().table("audit_logs").insert(
        {"org_id": t.org_id, "user_id": t.user_id, "action": "logout"}).execute()
    return ok({"ok": True})


@router.get("/me")
def me(t: Tenant = Depends(get_current_tenant)):
    return ok({"user_id": t.user_id, "org_id": t.org_id, "role": t.role})
