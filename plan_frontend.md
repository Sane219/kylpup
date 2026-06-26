# plan_frontend.md — Frontend Redefinition

> **Goal:** completely redefine the Klypup frontend into an attractive, premium **Bloomberg-modern** investment research terminal. Keep the React+Vite+TS+Tailwind SPA and the existing backend API contract; rebuild every visual and interaction layer.

## Locked decisions

| Decision | Choice |
|---|---|
| Aesthetic | **Bloomberg-modern** — dense, data-first, dark terminal feel. Mono tabular numerics, tight grids, sharp accents, restrained motion. |
| Theme | **Full dual-theme** (dark-first, light fully designed) with a persisted toggle. |
| Framework | **Keep Vite SPA** (React + TS + Tailwind + Recharts). Reuse `lib/api.ts`, `lib/auth.tsx`. No deploy change. |
| Scope | **Full visual + UX overhaul.** Same routes, same API responses, new everything visual. No new backend work. |

## Skill model

> **Parent skill — `impeccable` (design authority).** Every phase passes through it: it owns the design read, the dials, the anti-slop bans, and the **Iron Law (never ship the first version — build → critique → refine → pre-flight)**. In this repo `impeccable` is delivered via the `design-taste` skill (a synthesis of impeccable + design-engineering + taste). Invoke `design-taste` and operate in its impeccable lane. No phase ships without its pre-flight pass.

Supporting skills (serve the parent, never override it):

| Skill | Role in this plan |
|---|---|
| `design-taste` (**= impeccable parent**) | Design system, color/type/spacing, motion craft, anti-slop review, pre-flight gate. The authority. |
| `senior-frontend` | React/Vite component architecture, hooks, bundle budget, a11y, perf, state. Implements what impeccable specifies. |
| `senior-qa` | Component + interaction tests, loading/error/empty state coverage, build verification. |

MCP components: **21st.dev `magic` MCP** is the component source — use it heavily.
- `mcp__magic__21st_magic_component_inspiration` — browse before building each surface.
- `mcp__magic__21st_magic_component_builder` — generate the component, then hand to `design-taste` to re-skin to our tokens.
- `mcp__magic__21st_magic_component_refiner` — polish an existing component to spec.
- `mcp__magic__logo_search` — brand/logo marks (app logo, ticker/company marks).

**Rule for every 21st.dev pull:** generate → strip its default palette/shadows/radii → rebind to *our* design tokens (Phase F0) → run the impeccable anti-slop check. A 21st.dev component shipped with its stock styling fails the AI-slop test.

---

## Design language (the impeccable brief, resolved up front)

**Design Read:** *a professional analyst terminal for finance pros, with a dense Bloomberg-modern language, leaning toward a dark-first data-tool design system (Linear-grade polish, terminal density).*

Dials: **DESIGN_VARIANCE 3** (structured, grid-driven, not playful) · **MOTION_INTENSITY 2** (functional only — feedback + state, never decorative) · **VISUAL_DENSITY 8** (packed, information-rich).

- **Type:** one geometric/grotesk sans for UI (e.g. Geist / Söhne-like via a free alt), one **monospace for all numerics, tickers, prices, deltas** (tabular figures, `font-variant-numeric: tabular-nums`). Scale ratio ≥1.25. No serif. Avoid Inter-as-reflex; pick a distinctive grotesk.
- **Color (OKLCH tokens):** near-black ink surfaces (not `#000`), one **electric-cyan accent** locked across the app. Semantic financial colors: up/positive, down/negative, neutral — colorblind-safe (never red/green alone; pair with arrow + sign). Sentiment heat cells use a single-hue ramp. Tint neutrals slightly toward the accent hue. Contrast verified ≥4.5:1 body, ≥3:1 large.
- **Layout:** 4px spacing base, tight grid. Dividers and borders group data, not nested cards (**nested cards are banned**). One radius system (≤8px — terminal feel is sharper than consumer SaaS). Semantic z-index scale.
- **Motion:** `transform`/`opacity` only, <300ms, ease-out. Animate state changes (data arriving, route transition, sentiment update), never keyboard actions. `prefers-reduced-motion` fallback mandatory.
- **Copy:** verb+object buttons, no em dashes, no buzzwords, no fake numbers.

---

## Phases

Each phase: **(1) invoke the named skill(s) first; (2) pull components from 21st.dev where listed; (3) build; (4) impeccable critique + refine + pre-flight; (5) verify (tsc + build, and tests where listed); (6) focused commit, no Claude attribution.**

### Phase F0 — Design system foundation
> **Skill — MUST invoke:** `design-taste` (impeccable parent) for tokens/type/color/dials; `senior-frontend` for Tailwind wiring.

- OKLCH color tokens (CSS variables) for both themes; `data-theme` on `<html>`, persisted to localStorage, respects `prefers-color-scheme` on first load.
- Tailwind config: extend with token colors, the type scale, the 4px spacing scale, radius scale, semantic z-index, custom ease-out curve (`cubic-bezier(0.23, 1, 0.32, 1)`).
- Font loading (self-hosted/`@fontsource` to avoid CDN/CSP issues): UI grotesk + monospace, tabular numerics globally on numeric components.
- `globals.css`: reset already exists; add reduced-motion base, focus-visible ring token, selection color.
- **Deliverable:** `theme.ts` token map + a `/styleguide` dev-only route rendering every token, type step, color swatch, and state — the impeccable reference surface.

### Phase F1 — Primitives + app shell
> **Skill — MUST invoke:** `design-taste` (component craft, the eight interaction states); `senior-frontend` (architecture).
> **21st.dev:** inspiration + builder for sidebar nav, top bar, command palette, theme toggle, button, input, badge, tabs, tooltip, toast, skeleton, dialog.

- Rebuild `components/ui.tsx` into a real primitive set: Button (variants + 8 states), Input/Label/Field (label above, blur validation, `aria-describedby` errors), Badge (incl. sentiment + delta variants), Tabs, Tooltip, Toast, Skeleton, Dialog (native `<dialog>` + `inert`), Card (used sparingly — borders/dividers preferred).
- **App shell:** collapsible left sidebar nav (icons + labels, role-aware — Members only for admin), top bar with org name, theme toggle, user menu.
- **Command palette (⌘K)** — pull from 21st.dev: jump to routes, run a research query, open a saved report, search watchlist. This is the terminal-feel centerpiece.
- Loading/error/empty primitives reused everywhere.

### Phase F2 — Auth screens
> **Skill — MUST invoke:** `design-taste`; `senior-frontend`.
> **21st.dev:** login/signup form components, `logo_search` for the app mark.

- Login + signup (org-create vs invite-code path), wired to existing `lib/auth.tsx` and `/auth` endpoints. All 8 states: idle, validating, submitting, error (bad creds / duplicate email → friendly copy), success → redirect.
- Split-screen layout: form + a quiet branded panel (subtle grid/ticker motif, not a gradient blob).
- Keyboard-first, focus management, no placeholder-as-label.

### Phase F3 — Research query + structured result render (centerpiece)
> **Skill — MUST invoke:** `design-taste` (the most-polished surface — this is what gets graded); `senior-frontend` (rendering the agent JSON).
> **21st.dev:** search/command input, stat/metric cards, data table, chart container, sentiment badges, citation/source chips, tabs, accordion for filing insights.

The agent returns `company_cards[]`, `comparison_table`, `news_sentiment[]`, `filing_insights[]`, `risks[]`, `summary`, `sources_used` — every item carries a `citation`. Render each as a first-class block:
- **Query bar:** prominent, with example chips, live submit states, and a visible plan/progress indicator ("routing → fetching market+news → synthesizing").
- **Company cards:** mono price, signed delta with arrow + color, key stats grid.
- **Comparison table:** dense, tabular-nums, sticky header, sortable, sentiment heat cells.
- **News + sentiment:** list with sentiment badges, source + timestamp, citation chip linking out.
- **Filing insights:** accordion/cards with the chunk citation (`source_ref`) always visible.
- **Risks + summary:** structured, scannable.
- **Citations are never optional** — every block shows its source; a missing citation renders a visible "no source" warning, never silent.
- Skeleton loaders matched to each block; partial-failure UI (one tool failed → that block shows a soft error, the rest render).

### Phase F4 — Reports, Watchlist, Members
> **Skill — MUST invoke:** `design-taste`; `senior-frontend`.
> **21st.dev:** data table, list, empty-state, confirenation/undo toast, member/role table, avatar.

- **Reports:** saved-research list (table or card list), detail view reusing the Phase F3 render blocks, delete with **undo toast** (not a confirm dialog).
- **Watchlist:** add/remove tickers, live-ish quote row, empty state with a clear first-action.
- **Members (admin only):** roster table with role badges, invite-code reveal/copy, role gating enforced in UI (and already in API).

### Phase F5 — States, motion, a11y, responsive, pre-flight
> **Skill — MUST invoke:** `design-taste` (motion craft + **pre-flight matrix** + anti-slop catalogue) as the final design gate.

- Audit every surface for all 8 interaction states + loading/error/empty.
- Add purposeful motion only: route transitions, data-arrival fade/slide, toast, command palette spring-from-origin, theme-toggle crossfade. Verify reduced-motion fallbacks.
- Responsive: terminal density on desktop, graceful stacking down to tablet; sidebar → drawer on narrow.
- a11y: keyboard nav end-to-end, focus-visible rings, ARIA on icon buttons/dialogs/tabs, contrast re-verified in *both* themes.
- **Run the impeccable pre-flight (`reference/pre-flight.md`) + anti-slop check (`reference/anti-slop.md`).** Produce a Before/After/Why table. Nothing ships that reads as "AI made that."

### Phase F6 — QA + verification
> **Skill — MUST invoke:** `senior-qa`.

- Vitest + React Testing Library: smoke-render every page, the result-render mapping (agent JSON → blocks incl. missing-citation + partial-failure cases), auth flow, theme toggle persistence, command palette.
- `tsc --noEmit` + `npm run build` green; check bundle against the Vite-SPA budget (200 KB init / 80 KB per route).
- Wire frontend tests into `.github/workflows/ci.yml` (extend the existing `frontend` job).

---

## Success criteria (verifiable)

- Both themes pass WCAG AA contrast on every text/control.
- Per-route JS bundle ≤ budget; LCP target stated and met on desktop.
- Every research-result block renders its citation; partial tool failure degrades gracefully.
- Impeccable pre-flight passes; the AI-slop test fails to identify it as AI-made.
- `tsc`, `build`, and the new Vitest suite all green in CI.

## Open questions for you (answer any time — I'll default otherwise)

1. **Brand:** is "Klypup" the final product name, and do you have a logo/wordmark, or should I generate one (via `logo_search` + a simple mark)?
2. **Fonts:** any licensed font you want, or shall I pick free distinctive grotesk + mono (self-hosted)? *Default: free pair, self-hosted.*
3. **Accent:** electric-cyan as specified, or a different signature accent? *Default: cyan.*
4. **New features in scope?** You chose "visual + UX overhaul" (not new features), but the command palette and compare-view edge toward new capability — keep them? *Default: keep command palette, no other new features.*
