from pydantic import BaseModel, EmailStr, Field


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    # exactly one of these: create a new org, or join an existing one
    org_name: str | None = Field(default=None, max_length=120)
    invite_code: str | None = Field(default=None, max_length=64)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class WatchlistIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=12)


class ResearchIn(BaseModel):
    query: str = Field(min_length=3, max_length=2000)


class ReportPatch(BaseModel):
    tags: list[str] | None = None
    query: str | None = Field(default=None, max_length=2000)  # acts as title/rename
