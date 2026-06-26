<p align="center">
  <img src="../LOGO.png" alt="Klypup" width="240">
</p>

# API Reference

Base URL: `http://localhost:8000` (local) or your Render deployment URL.

All protected routes require `Authorization: Bearer <jwt>` where the JWT is obtained from `POST /auth/login`.

## Response Envelope

Every response follows a consistent envelope:

```json
{
  "data": { ... },
  "meta": { ... }
}
```

Errors:

```json
{
  "error": {
    "code": "not_found",
    "message": "report not found",
    "details": {}
  },
  "meta": {}
}
```

## Auth

### `POST /auth/signup`

Create a new account. Provide exactly one of `org_name` (creates a new org — caller becomes **admin**) or `invite_code` (joins existing org — caller becomes **analyst**).

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "org_name": "Acme Corp"
}
```

**Response (201):**
```json
{
  "data": {
    "user_id": "uuid",
    "org_id": "uuid",
    "role": "admin",
    "invite_code": "abc123xyz"
  }
}
```

Errors: `400` (missing org_name/invite_code), `404` (invalid invite_code), `409` (duplicate email).

### `POST /auth/login`

Authenticate and receive a JWT.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "token_type": "bearer"
  }
}
```

Errors: `401` (invalid credentials).

### `POST /auth/logout`

Protected. Invalidates the session on the client side and records an audit log entry.

**Response (200):**
```json
{ "data": { "ok": true } }
```

### `GET /auth/me`

Protected. Returns the authenticated user's identity and role.

**Response (200):**
```json
{
  "data": {
    "user_id": "uuid",
    "org_id": "uuid",
    "role": "admin"
  }
}
```

## Orgs

### `GET /orgs/invite`

Protected. **Admin only.** Returns the organization's invite code and name.

**Response (200):**
```json
{
  "data": {
    "invite_code": "abc123xyz",
    "org_name": "Acme Corp"
  }
}
```

### `GET /orgs/members`

Protected. Lists all members of the current organization.

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "admin@acme.test",
      "role": "admin",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

## Research

### `POST /research`

Protected. Runs the AI agent against the natural-language query, saves the result as a report, and returns the structured analysis.

The agent flow:
1. **Router LLM** analyzes the query and selects data tools
2. Selected tools run concurrently (market data, news, filings)
3. **Synthesizer LLM** produces structured JSON with citations

**Request:**
```json
{
  "query": "Compare Tesla and Ford — stock performance, recent news, and key risks"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "org_id": "uuid",
    "user_id": "uuid",
    "query": "Compare Tesla and Ford...",
    "result_json": {
      "summary": "Tesla shows strong...",
      "company_cards": [
        {
          "ticker": "TSLA",
          "name": "Tesla, Inc.",
          "price": 245.67,
          "market_cap": 780000000000,
          "pe_ratio": 68.5,
          "eps": 3.59,
          "revenue": 96800000000,
          "highlight": "Revenue grew 18% YoY",
          "citation": "yfinance"
        }
      ],
      "comparison_table": {
        "columns": ["Metric", "TSLA", "F"],
        "rows": [
          ["P/E", "68.5", "7.2"],
          ["Market Cap", "780B", "45B"]
        ]
      },
      "news_sentiment": [
        {
          "ticker": "TSLA",
          "title": "Tesla Q3 deliveries beat estimates",
          "sentiment": "positive",
          "url": "https://...",
          "citation": "Reuters"
        }
      ],
      "filing_insights": [],
      "risks": [
        {
          "ticker": "TSLA",
          "risk": "Valuation premium vs peers",
          "citation": "yfinance"
        }
      ],
      "sources_used": ["yfinance", "duckduckgo-news"],
      "_plan": {
        "companies": ["TSLA", "F"],
        "fetch_market": true,
        "fetch_news": true,
        "search_filings": false,
        "filing_query": ""
      }
    },
    "tags": [],
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

Errors: `503` (research engine unavailable / tool failure).

### `GET /research`

Protected. List saved research reports for the current org. Supports search and tag filtering.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search in query text (case-insensitive `ILIKE`) |
| `tag` | string | Filter reports containing this tag |

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "query": "Compare Tesla and Ford...",
      "tags": ["earnings", "comparison"],
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### `GET /research/{id}`

Protected. Get a single report by ID (scoped to current org — IDOR guard enforced).

**Response (200):** Full report object with `result_json`.

Errors: `404` (not found).

### `PATCH /research/{id}`

Protected. Update tags or rename a report.

**Request:**
```json
{
  "tags": ["earnings", "q3-2025"],
  "query": "Updated display title"
}
```

**Response (200):** Updated report.

Errors: `400` (nothing to update), `404` (not found).

### `DELETE /research/{id}`

Protected. Remove a report.

**Response:** `204 No Content`.

Errors: `404` (not found).

## Watchlist

### `GET /watchlist`

Protected. List the current user's watched tickers (org-scoped).

**Response (200):**
```json
{
  "data": [
    { "id": "uuid", "ticker": "AAPL", "created_at": "2025-01-01T00:00:00Z" }
  ]
}
```

### `POST /watchlist`

Protected. Add a ticker to the watchlist (upsert per `org_id + user_id + ticker`).

**Request:**
```json
{ "ticker": "AAPL" }
```

**Response (201):** Created watchlist entry.

### `DELETE /watchlist/{ticker}`

Protected. Remove a ticker from the watchlist.

**Response:** `204 No Content`.

## Health

### `GET /health`

Unauthenticated. Liveness check.

**Response (200):**
```json
{ "status": "ok" }
```

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | Deleted (no body) |
| 400 | Bad request / validation error |
| 401 | Missing or invalid JWT |
| 403 | Insufficient role or no organization |
| 404 | Resource not found |
| 409 | Conflict (duplicate email) |
| 503 | Research engine (AI/tool) unavailable |

## Authentication Flow

```
Signup/Login
  └─ POST /auth/signup or /auth/login
  └─ Returns {"access_token": "eyJ..."}
  └─ Store token (localStorage / memory)
  └─ Attach to every subsequent request:
       Authorization: Bearer eyJ...

Protected Route (server side):
  └─ Extract Bearer token
  └─ Verify JWT (HS256, audience=authenticated)
  └─ Decode app_metadata → {org_id, role}
  └─ If no org_id → 403
  └─ If role insufficient for endpoint → 403
  └─ Attach Tenant(user_id, org_id, role) to request
  └─ Every query filters .eq("org_id", tenant.org_id)
```

All protected routes enforce tenant isolation at the query level. Single-resource lookups (`GET /research/{id}`) filter by **both** `org_id` and `id` to prevent IDOR attacks.
