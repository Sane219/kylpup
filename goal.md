# Klypup — Applied AI Intern Technical Assessment

**Choose Your Challenge. Build End-to-End. Ship It.**

| Field | Details |
|---|---|
| **Duration** | 5 calendar days from date of receipt |
| **Format** | Full-stack web application + architecture document + live demo |
| **Problem Choice** | Choose ONE of two problem statements (see Section 2) |
| **Tech Stack** | Your choice — MERN, PERN, Django+React, FastAPI+Next.js, or anything you ship with |
| **AI Integration** | Any LLM API (OpenAI, Anthropic, Bedrock, Groq, Ollama, etc.) |
| **Cloud / Deploy** | Any platform (Vercel, Railway, Render, AWS, GCP, Azure). AWS experience is a plus. |
| **Assisted Coding** | Cursor, Copilot, Claude, ChatGPT — all permitted and encouraged |
| **Submission** | GitHub repository + README + Architecture document + DECISIONS.md |
| **Presentation** | 15-min walkthrough + 15-min live demo + 10-min Q&A |

---

## 1. Our Philosophy: Applied AI, Not AI in Isolation

At Klypup, AI doesn't live in a Jupyter notebook. It lives inside products — full-stack applications with real users, authentication, data persistence, and production-quality interfaces. The AI is a feature inside the product, not the product itself.

This assessment tests:

- Can you architect and build a full-stack application end-to-end?
- Can you integrate AI as a feature that adds real value — not just a chatbot wrapper?
- Do you understand data modeling, auth, API design, and multi-tenant patterns?
- Can you make architectural decisions, document them, and explain the trade-offs?
- Do you think like a product builder — not just a coder?

### Assisted-First Coding

We are an assisted-first engineering team. Using AI coding tools (Cursor, Copilot, Claude, ChatGPT) is permitted and encouraged. We believe the best engineers in 2026 leverage AI to move at 3x speed while understanding what they're building. But assisted-first ≠ clueless-first. You must be able to explain every architectural decision and major code block during the live interview. If you can't explain it, it doesn't count.

---

## 2. Challenge: Investment Research Dashboard

#### Business Context

Research analysts at a financial services firm spend days per company manually gathering data — pulling stock prices from terminals, reading through dozens of news articles, combing through SEC filings and earnings transcripts. By the time the research is compiled, market conditions may have already shifted.

**Your goal:** build a full-stack web application that lets an analyst type a research query and receive an AI-powered, structured, source-attributed analysis in minutes instead of days.

#### Example User Queries

> "Analyze NVIDIA's Q3 earnings report. Compare revenue growth with AMD and Intel. Provide information on top companies using NVIDIA GPUs and revenue from them. Summarize competitive threats and recent news sentiment. Provide a risk assessment based on current market conditions."

> "Give me a quick overview of Tesla — stock performance this quarter, any major news in the last 30 days, and key risks."

> "Compare the balance sheets of JPMorgan, Goldman Sachs, and Morgan Stanley. Which has the strongest capital position?"

#### Application Requirements

- **Authentication & User Workspaces:** Signup/login (JWT, OAuth, or session-based). Each user has a personal workspace. Users within the same organization share a workspace but cannot see other organizations' data (see multi-tenant requirements in Section 3.3).
- **Dashboard Home:** A clean landing page showing the user's recent research queries, saved reports, bookmarked companies, and quick-action buttons ("New Research", "Compare Companies", etc.).
- **Research Query Interface:** A query input where the user describes what they want to research in natural language. The system processes the query through the AI layer, orchestrates the right data tools, and returns structured results.
- **Structured Results Display:** AI results must be rendered as structured UI components — not a wall of text. Use cards for company overviews, tables for financial comparisons, charts for stock performance, sentiment indicators for news, and clear section headers. Every data point must show its source.
- **Saved Research & History:** Full CRUD — users can save research reports, tag them (e.g., "Q3 Earnings", "Competitor Analysis"), search through past research, and delete old reports.
- **Company Watchlist (recommended):** Users can add companies to a watchlist for quick access and recurring analysis.

#### AI Agent & Tool Orchestration

The AI layer is the intelligence engine of the product. It should not be a simple prompt-in/text-out wrapper. Build an agentic flow where the LLM:

- Analyzes the query to understand what data is needed (stock prices? news? filings? comparisons?)
- Decides which tools to invoke based on the query — not a hardcoded sequence. If the user asks only about news, the agent should not call the stock price API unnecessarily.
- Orchestrates multiple tools in parallel or sequence as needed (e.g., fetch stock data for 3 companies + fetch news for all 3 + search filings)
- Synthesizes results into a coherent, structured analysis with clear sections, comparisons, and a summary
- Attributes every claim to a specific data source (API, article, filing)

#### Required Data Integrations

1. **Market Data Tool**
   - Integrate with a free financial API (Yahoo Finance, Alpha Vantage, Financial Modeling Prep, or similar)
   - Fetch: real-time stock prices, trading volume, key financial metrics (P/E, market cap, revenue, EPS), and historical price data
   - The agent should be able to pull data for multiple companies in a single query

2. **News Search & Sentiment Tool**
   - Implement financial news retrieval from NewsAPI, RSS feeds (Reuters, Bloomberg RSS, etc.), or any free news source
   - Extract and summarize relevant news for queried companies
   - Include sentiment analysis — at minimum, classify news as positive/negative/neutral and surface this in the UI
   - Show recency — prioritize news from the last 7–30 days

3. **Document Knowledge Base**
   - Create a simple vector store or search index containing sample SEC filings, earnings reports, or analyst reports for 3–5 companies
   - Use FAISS, Pinecone free tier, ChromaDB, Weaviate, or even a well-implemented keyword/BM25 search
   - The agent should query this knowledge base when the user asks about filings, earnings details, or company fundamentals not available via the market data API
   - Include the ingestion pipeline — show how documents are chunked, embedded, and stored

4. **API Interface**
   - All AI and data functionality must be exposed via clean REST (or GraphQL) API endpoints
   - The frontend calls the backend API — no direct LLM calls from the browser
   - Include proper error handling, loading states, and timeout management

## 3. Application Requirements

Regardless of the option chosen, your submission must meet all of the following.

### 3.1 Full-Stack Application

- **Authentication:** Working user auth (JWT, OAuth, or session-based). No fake/hardcoded logins. Include signup, login, logout, and protected routes.
- **Database:** Persistent storage with a proper schema (PostgreSQL, MongoDB, Supabase, Firebase, etc.). Data must survive server restarts.
- **API Layer:** Clean REST or GraphQL API with proper error handling, input validation, meaningful HTTP status codes, and consistent response formats.
- **Frontend:** A functional, clean UI built with a modern framework. This is a product, not a Postman collection. Include loading states, error states, and empty states.
- **CRUD Operations:** Users can create, read, update, and delete their core data (research reports / pricing rules / product configurations).
- **Responsive Design:** Must work well on desktop. Mobile-responsive is a plus.

### 3.2 AI Integration (as a Feature, Not the Product)

- **LLM Integration:** Use any LLM API (OpenAI, Claude, Bedrock, Groq, Ollama — your choice). The AI powers a core feature but is not the entire application.
- **Tool / Function Calling:** The LLM must orchestrate at least 2 external data tools. It should decide which tools to call based on the user's input — not a hardcoded sequence every time.
- **Structured Output:** AI responses must be parsed and rendered as structured UI components (cards, tables, charts, confidence indicators, sentiment badges) — not dumped as raw text or markdown.
- **Source Attribution:** Every AI-generated insight must clearly show where the data came from (which API, which article, which data source).
- **Error Handling:** Gracefully handle LLM failures, API timeouts, and rate limits. The app should not crash if the AI service is temporarily unavailable.

### 3.3 Multi-Tenant Architecture (Required)

Your application must demonstrate multi-tenant awareness. This is a core requirement, not a bonus.

- **Data Isolation:** Users or organizations cannot see each other's data. A user in Org A cannot access Org B's saved research, products, or pricing rules. All database queries must be scoped to the current tenant.
- **Role-Based Access Control (RBAC):** At least 2 roles with different permissions. For Option A: e.g., Admin (manages workspace, invites users) vs Analyst (creates research, views reports). For Option B: Admin (configures thresholds, manages catalog) vs Pricing Analyst (reviews recommendations).
- **Organization Management:** Basic org creation, user invitation or joining flow. Can be simple (invite code or email-based).
- **Tenant Context in API:** Every API request should resolve the current user's tenant and enforce isolation at the query level (middleware or equivalent pattern).

> Implementation can be simple (org_id column + middleware filtering) or sophisticated (schema-per-tenant). We care that you understand the pattern and implement it correctly, not that it's enterprise-grade.

### 3.4 Tech Stack

Use whatever full-stack framework you are strongest in. We evaluate your ability to build and ship, not which specific tools you picked.

| Layer | Options (non-exhaustive) | What We Evaluate |
|---|---|---|
| **Frontend** | React, Next.js, Vue, Svelte, Angular | Component design, state management, UX quality |
| **Backend** | Node/Express, FastAPI, Django, NestJS, Go | API design, error handling, auth, multi-tenancy |
| **Database** | PostgreSQL, MongoDB, Supabase, Firebase | Schema design, tenant isolation, data modeling |
| **AI / LLM** | OpenAI, Claude API, Bedrock, Groq, Ollama | Prompt design, tool orchestration, structured output |
| **Cloud (bonus)** | Vercel, Railway, Render, AWS, GCP, Azure | Deployment is bonus. AWS is a plus. |

### 3.5 Code Quality & Engineering Standards

- Clean project structure — separate concerns (routes, controllers, services, models, utils)
- Environment variables for all secrets with `.env.example` included
- Error handling and input validation on both frontend and backend
- Basic logging (console or structured — bonus for observability tools)
- Clean, meaningful commit history showing your workflow and thought process
- Include error handling, loading states, and edge cases in the UI

---

## 4. Deliverables

### 4.1 GitHub Repository

- Complete source code with meaningful, frequent commit history
- `README.md` containing: which option you chose and why, tech stack and rationale, setup instructions that actually work (tested on a clean machine or Docker), screenshots of the running application (at least 4–6 screens), and known limitations
- `.env.example` with all required environment variables documented and described
- Seed data or scripts to populate the app for demo (the evaluator should be able to run your app and see data immediately)

### 4.2 Architecture Document (`ARCHITECTURE.md` or PDF)

This is a required deliverable. Include the following:

- **System Architecture Diagram:** High-level view showing frontend, backend, database, AI layer, external APIs, and how they connect. Show the boundaries clearly.
- **Data Flow Diagram:** Trace how a user action flows through the entire system — from UI input → API request → auth/tenant middleware → AI processing → data fetching → database write → rendered output. Show the complete journey.
- **Database Schema / ER Diagram:** Your full data model — users, organizations, roles, core entities (research reports or products/pricing rules), audit logs, relationships, and indexes.
- **AI Orchestration Flow:** How the LLM receives a query, plans which tools to call, executes them (parallel or sequential), aggregates results, and produces structured output.
- **Multi-Tenant Data Flow:** How tenant isolation is enforced — from the HTTP request through middleware to the database query. Show that Org A's data never leaks to Org B.
- **API Design:** List your key API endpoints with methods, auth requirements, request/response shapes. Can be a table or OpenAPI-style listing.

> Diagrams can be made with draw.io, Excalidraw, Mermaid, Eraser, tldraw, or hand-drawn and photographed. Clarity and correctness matter more than visual polish.

### 4.3 `DECISIONS.md`

A document (1–2 pages) answering:

- Which option did you choose and why?
- Why this tech stack? What alternatives did you consider?
- How did you approach multi-tenancy? What pattern did you use and why?
- How did you design the AI integration? What prompt engineering decisions did you make?
- What trade-offs did you make given the 5-day timeline?
- What would you improve with 2 more weeks?
- What was the hardest part and how did you solve it?

### 4.4 Working Demo

The app must be runnable locally with clear setup instructions (Docker Compose preferred). You should be able to demo at least 3 different user workflows live during the interview, covering:

- The core AI-powered feature (research query or pricing recommendation)
- Multi-tenant isolation (show 2 orgs with separate data)
- Role-based access (show different capabilities for different roles)

---

## 5. Evaluation Criteria

| Criteria | Weight | What We're Looking For |
|---|---|---|
| **Full-Stack Engineering** | 30% | Working app with auth, CRUD, clean UI, proper API design, database schema. Does the app actually work? |
| **AI Integration Quality** | 25% | AI as a well-integrated feature. Tool/function calling, structured output, source attribution. Not a chatbot wrapper. |
| **Architecture & Code Quality** | 20% | Clean project structure, error handling, meaningful diagrams, sensible decisions in DECISIONS.md. Code quality matters. |
| **Multi-Tenant Implementation** | 15% | Data isolation works correctly, RBAC enforced, tenant-scoped queries. Can you demo 2 orgs with separate data? |
| **Communication & Product Thinking** | 10% | Does it feel like a product someone would use? Clear README, good UX, ability to articulate decisions. |

---

## 6. Bonus Points (Optional)

Not required, but demonstrates depth, initiative, and production-readiness:

- **Live Deployment:** App deployed to any cloud platform with a working URL. AWS deployment is a plus but any platform counts.
- **Real-Time Streaming:** WebSocket or SSE for streaming AI responses as they generate, giving the user instant feedback.
- **Docker Compose:** One-command local setup with `docker-compose up` that spins up frontend, backend, database, and any supporting services.
- **Testing:** Unit tests for core business logic, integration tests for API endpoints.
- **CI/CD:** Basic GitHub Actions pipeline for lint/test/build.
- **Caching & Rate Limiting:** Handle external API rate limits gracefully; cache repeated queries to save cost and improve speed.
- **Export Feature:** Let users export research reports or pricing analysis as PDF or CSV.
- **Observability:** Basic monitoring, health checks, structured logging, or integration with CloudWatch / Datadog / equivalent.
- **Infrastructure as Code:** Terraform, CDK, SAM, or Pulumi templates for your cloud resources.


---

## 7. Important Notes

- **Assisted coding is encouraged.** You must be able to explain every architectural decision and major code block during the live interview. If you can't explain it, it doesn't count.
- **Use free-tier APIs and services.** Note any cost constraints that limited your implementation in `DECISIONS.md`.
- **Mock or synthetic data is acceptable** where free APIs have limitations. Include data generation scripts if applicable.
- **Focus on a working product over perfection.** An app that runs with 80% features beats a broken app with 100% ambition.
- **Commit frequently.** We review your commit history to understand how you work, how you think, and how you iterate.
- **Choose the option that excites you.** Both are evaluated equally. There is no "safer" choice.
- **Include a `.gitignore`.** No `node_modules`, no `.env` files, no build artifacts in the repo.
- **Test your setup instructions.** Clone your repo to a fresh directory and follow your own README. If it doesn't work for you, it won't work for us.

---

Questions? Reach out to the hiring contact provided in your assessment notification email.

**Good luck — we're excited to see what you build.** ■
