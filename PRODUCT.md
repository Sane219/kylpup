# Product

## Register

product

## Users
Buy-side and sell-side analysts running fast, ad-hoc investment research. They live in front of multiple monitors, scan prices and headlines continuously, and switch between "watching the tape" and "asking a deep question." Context: a trading-desk environment, high information density, dark room, long sessions.

## Product Purpose
Klypup turns a natural-language question into sourced, structured research: market data, news sentiment, and SEC-filing search, orchestrated by an agentic LLM flow and rendered as cards, tables, and charts with citations. Multi-tenant with RBAC. Success = an analyst trusts the answer fast enough to act on it.

## Brand Personality
Terminal-grade, alive, precise. Reads like a Bloomberg/terminal cockpit, not a SaaS dashboard. Confident and dense, never decorative. The interface should feel like the market is moving through it.

## Anti-references
- Generic light SaaS dashboards (rounded cards, pastel, lots of whitespace).
- Crypto-bro neon gradients and glassmorphism.
- Chatbot-first UIs. Research is structured output, not a chat log.

## Design Principles
- **Show the tape.** Live, moving data is the ambient state, not a feature you click into.
- **Density with hierarchy.** Pack information, but make the one number that matters obvious.
- **Mono for numbers, always.** Tabular figures, aligned, never reflowing.
- **Color is signal, not decor.** Green/red mean direction; accent means action or selection. Nothing else.
- **Earned familiarity.** Standard terminal affordances over invented ones.

## Accessibility & Inclusion
WCAG AA. Direction is never color-only (arrows + sign accompany green/red). Full `prefers-reduced-motion` support: the ticker and price flashes degrade to static. Keyboard-first (command palette, focus rings).
