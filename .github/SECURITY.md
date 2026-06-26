# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| main    | ✅ Active development |

## Reporting a Vulnerability

If you discover a security vulnerability, **do not open a public issue**. Instead, report it privately by emailing the project maintainers.

Please include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact

You should receive a response within 48 hours. If the issue is confirmed, a fix will be released as soon as possible, and you will be credited (unless you prefer to remain anonymous).

## Security Considerations

This project handles financial research data and enforces multi-tenant isolation. Key security properties:

- **Tenant isolation** is enforced in backend app code (every query scoped by `org_id`) because the Supabase service key bypasses RLS. RLS policies exist as defense-in-depth.
- **JWT authentication** uses HS256 with a server-held secret. Tokens are verified on every protected route.
- **No direct LLM calls from the browser** — all AI/data requests go through the backend API.
- **LLM keys** (Gemini, Groq) are server-side env vars only — never exposed to the client.

## AI-Specific Risks

- Prompt injection through research queries is mitigated by the router LLM's low temperature (0.2) and schema-first output enforcement (native JSON mode).
- Tool outputs are validated before being passed to the synthesizer.
- If an LLM provider is compromised, the fallback provider limits blast radius.
