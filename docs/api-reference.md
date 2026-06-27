<p align="center">
  <img src="../LOGO.png" alt="Klypup" width="240">
</p>

# API Reference

All endpoints live under `https://your-backend.com` and return the standard envelope:

```json
// Success
{ "data": <response>, "meta": {} }

// Error
{ "error": { "code": "...", "message": "...", "details": null },
  "meta": { "request_id": "<uuid>" } }
```

Authentication is via `Authorization: Bearer <JWT>` header for protected endpoints.

---

## Auth

### `POST /auth/signup`

Create a new organization (admin) or join an existing one (analyst).

**Request:**
```json
{
  "email": "user@firm.com",
  "password": "securepass123",
  "org_name": "Acme Capital"        // OR invite_code
  // "invite_code": "abc123def"
}
```

**Response (201):**
```json
{
  "user_id": "uuid",
  "org_id": "uuid",
  "role": "admin",
  "invite_code": "abc123def"       // only for admins
}
```

**Errors:** `400` (missing org_name/invite_code), `409` (duplicate email), `404` (invalid invite_code)

---

### `POST /auth/login`

Authenticate and receive a JWT.

**Request:**
```json
{
  "email": "user@firm.com",
  "password": "securepass123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJFUzI1NiIs...",
  "refresh_token": "abc...",
  "token_type": "bearer"
}
```

**Errors:** `401` (invalid credentials)

---

### `POST /auth/logout`

Record a logout audit entry. Requires auth.

**Response (200):**
```json
{ "ok": true }
```

---

### `GET /auth/me`

Return the current user's tenant information. Requires auth.

**Response (200):**
```json
{
  "user_id": "uuid",
  "org_id": "uuid",
  "role": "admin"
}
```

---

## Market

### `GET /market/snapshot`

Fetch compact quotes for one or more ticker symbols. Requires auth.

**Query parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `symbols` | string | Comma-separated tickers, e.g. `AAPL,MSFT,SPX` (max 60) |

**Response (200):**
```json
[
  {
    "symbol": "AAPL",
    "price": 226.80,
    "prevClose": 225.10,
    "change": 1.70,
    "changePct": 0.76,
    "history": [310.85, 312.51, 306.31],
    "currency": "USD",
    "source": "yfinance"
  },
  {
    "symbol": "SPX",
    "price": 7354.02,
    "prevClose": 7357.49,
    "change": -3.47,
    "changePct": -0.05,
    "history": [7410.2, 7380.1, 7354.0],
    "currency": null,
    "source": "yfinance"
  }
]
```

**Index ticker mapping:**

| Symbol | yfinance |
|--------|----------|
| SPX | ^GSPC |
| NDX | ^NDX |
| DJI | ^DJI |
| VIX | ^VIX |
| BTC | BTC-USD |
| US10Y | ^TNX |

---

## Organizations

### `GET /orgs/invite`

Get the organization's invite code and name. Admin only.

**Response (200):**
```json
{
  "invite_code": "abc123def",
  "org_name": "Acme Capital"
}
```

**Errors:** `403` (not admin)

---

### `GET /orgs/members`

List all members of the organization.

**Response (200):**
```json
[
  { "id": "uuid", "email": "admin@firm.com", "role": "admin", "created_at": "..." },
  { "id": "uuid", "email": "analyst@firm.com", "role": "analyst", "created_at": "..." }
]
```

---

## Research

### `POST /research`

Run the full AI research agent and save the report. Requires auth.

**Request:**
```json
{
  "query": "Compare NVDA and AMD on revenue growth, valuation, and key risks"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "org_id": "uuid",
  "user_id": "uuid",
  "query": "Compare NVDA and AMD...",
  "result_json": { ... },
  "tags": [],
  "created_at": "2024-...",
  "updated_at": "2024-..."
}
```

The `result_json` contains the full `ResearchData` object (see below).

**Errors:** `503` (research engine unavailable)

---

### `POST /research/stream`

Same as `POST /research` but returns a newline-delimited JSON stream (SSE) of the agent's progress. The final event is a `saved` event with the persisted report.

**Event types:**

```
{"type":"status","stage":"routing"}
{"type":"thinking","stage":"routing","delta":"..."}        // streaming thought
{"type":"plan","plan":{"companies":["NVDA","AMD"],...}}    // router output
{"type":"tool","tool":"market","status":"running"}
{"type":"tool","tool":"market","status":"done","summary":"2 quotes","preview":[...]}
{"type":"thinking","stage":"synth","delta":"..."}
{"type":"synth","status":"done"}
{"type":"review","status":"done","summary":"1 gap found","detail":["..."]}
{"type":"refine","status":"done","summary":"draft revised"}
{"type":"result","result":{...}}                           // final ResearchData
{"type":"saved","report":{"id":"uuid",...}}                // persisted report
{"type":"error","message":"..."}                           // on failure
```

---

### `GET /research`

List saved research reports for the user's organization.

**Query parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search in query text (optional) |
| `tag` | string | Filter by tag (optional) |

**Response (200):**
```json
[
  {
    "id": "uuid",
    "query": "Compare NVDA and AMD...",
    "tags": ["semiconductors", "comparison"],
    "created_at": "2024-..."
  }
]
```

---

### `GET /research/{id}`

Get a single saved report.

**Response (200):**
```json
{
  "id": "uuid",
  "org_id": "uuid",
  "user_id": "uuid",
  "query": "...",
  "result_json": { ... },
  "tags": ["...", "..."],
  "created_at": "..."
}
```

**Errors:** `404` (not found)

---

### `PATCH /research/{id}`

Update a report's tags or query text.

**Request:**
```json
{
  "tags": ["semiconductors", "valuation"],
  "query": "New title for the report"
}
```

Both fields are optional (at least one required).

**Response (200):** Updated report object.

**Errors:** `400` (no fields to update), `404` (not found)

---

### `DELETE /research/{id}`

Delete a research report.

**Response:** `204 No Content`

---

## Watchlist

### `GET /watchlist`

List the current user's tracked tickers.

**Response (200):**
```json
[
  { "id": "uuid", "ticker": "NVDA", "created_at": "..." },
  { "id": "uuid", "ticker": "AMD", "created_at": "..." }
]
```

---

### `POST /watchlist`

Add a ticker to the user's watchlist.

**Request:**
```json
{ "ticker": "NVDA" }
```

**Response (201/200):** The created watchlist entry.

---

### `DELETE /watchlist/{ticker}`

Remove a ticker from the watchlist.

**Response:** `204 No Content`

---

## Health

### `GET /health`

**Response (200):**
```json
{ "status": "ok" }
```

---

## ResearchData Type (result_json structure)

The `result_json` field in research reports contains this schema:

```typescript
{
  /** 4-6 sentence executive summary */
  summary?: string;

  /** 3-6 quantified insights */
  key_takeaways?: string[];

  /** One per company researched */
  company_cards?: Array<{
    ticker: string;
    name: string;
    price: number | null;
    market_cap: number | null;
    pe_ratio: number | null;
    eps: number | null;
    revenue: number | null;
    highlight: string;             // punchy one-liner
    thesis: string;                // 2-3 sentence position/valuation
    history?: Array<{date: string, close: number}>;  // sparkline data
    change_pct?: number;
    citation: string;              // data source
  }>;

  /** Side-by-side comparison */
  comparison_table?: {
    columns: string[];             // ["Metric", "AAPL", "MSFT", ...]
    rows: string[][];             // [["P/E", "30", "35"], ...]
  };

  /** News with sentiment */
  news_sentiment?: Array<{
    ticker?: string;
    title: string;
    sentiment: "positive" | "negative" | "neutral";
    takeaway?: string;
    url: string;
    citation: string;
  }>;

  /** SEC filing passages */
  filing_insights?: Array<{
    ticker?: string;
    insight: string;
    citation: string;
  }>;

  opportunities?: Array<{ticker?: string; opportunity: string; citation: string}>;
  risks?: Array<{ticker?: string; risk: string; citation: string}>;

  /** Forward synthesis */
  outlook?: string;

  /** Which tools contributed data */
  sources_used?: string[];         // e.g. ["yfinance", "duckduckgo-news", "sec-filing-kb"]

  // Internal fields (not displayed in UI):
  _plan?: {...};                   // the router's execution plan
  _review?: {issues?: string[]; revised?: boolean};  // critique results
}
```

Every figure or claim must carry a `citation` field. The `Cite` component in the frontend renders it, and the UI flags items missing a source.
