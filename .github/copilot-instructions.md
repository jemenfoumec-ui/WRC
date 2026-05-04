<!-- Copilot instructions for AI coding agents working on WRC-V5 -->

# WRC-V5 — Copilot Instructions

Purpose: give an AI coding agent the minimal, practical context to be productive in this repository.

- **Big picture:** This is a static front-end repo (no bundler required) for the WRC app. It is a modular, ES-module JavaScript app that runs in-browser and talks directly to Supabase for auth, storage and DB operations.

- **Entry points:**
  - `index.html` — main public landing page and example of how the app shell is composed.
  - `script.js` — primary app logic (auth UI glue, modal behavior, event wiring).
  - `wrc-nav.js` — app shell / navigation injection (sidebar, mobile header). Many pages rely on it for routing and the `wrc-auth-change` event.

- **Auth & data flow:**
  - `supabaseClient.js` exports `supabase`, utility functions (e.g. `fetchLeaderboard`, `uploadTrack`, `voteForTrackRPC`) and cache helpers. It imports Supabase from CDN as an ESM module.
  - `config.js` holds `supabaseConfig`, `CACHE_CONFIG` and `RATE_LIMITS`. In production it can read `import.meta.env` vars.
  - Auth lifecycle: `wrc-auth.js` + `script.js` use `supabase.auth.*`. Auth state is propagated with the `wrc-auth-change` event and stored in `localStorage`/`sessionStorage` under `wrc_user`.

- **Database / storage conventions (observed):**
  - Tables: `profiles`, `tracks` are used. `profiles` holds `role` and `is_admin`. `tracks` stores `file_url`, `artist_id`, `votes_count`.
  - Storage bucket: `tracks` (public URLs created by `supabase.storage.getPublicUrl`).
  - Server-side RPC: `vote_for_track` is called via `supabase.rpc('vote_for_track', ...)`.

- **Protected pages:** pages that require auth are referenced in `wrc-nav.js` and `README.md`: `dashboard.html`, `dashboard-admin.html`, `dashboard-jury.html`, `tournament-arena.html`, `tournament-registration.html`, `profile-edit.html`.

- **Project patterns & conventions to follow:**
  - Modules use ES `export`/`import` and are loaded via `<script type="module">` in HTML; therefore files must be served over HTTP (a static server) so ESM imports resolve.
  - Global integration points: many modules expose globals on `window` (e.g. `window.openAuth`, `window.wrcNav`, `window.wrcAuth`, `wrcToast`). When editing, avoid breaking these global names unless you update callers.
  - UI orchestration is DOM-first: code frequently queries elements by id/class and toggles classes. Prefer minimal, focused changes rather than adding new frameworks.
  - Cache & rate-limits: `supabaseClient.js` includes a cache manager and there are project-level `CACHE_CONFIG` and `RATE_LIMITS` constants in `config.js`. Adjust these rather than inventing new caching unless needed.

- **How to run / test locally (practical):**
  - Use a static HTTP server (ES modules require HTTP): e.g. `python -m http.server 8000` or `npx http-server` from repo root, then open `http://localhost:8000/index.html`.
  - Ensure `config.js` points to a valid Supabase URL/KEY or provide env replacements in a bundler/dev server if you add one.

- **Files to edit for common tasks (examples):**
  - Change navigation or add pages: edit `wrc-nav.js` (NAV_ITEMS, protected pages logic). Example: add menu entry to `NAV_ITEMS.main`.
  - Update auth UI or flows: edit `wrc-auth.js` and `script.js` (auth form handling and `openAuth` hooks).
  - Data access / API changes: edit `supabaseClient.js`. Example: update `fetchLeaderboard(limit)` signature or caching TTL inside `getCachedData`.
  - Adjust design tokens / layout: edit `wrc-core.css`, `wrc-layout.css`, `wrc-components.css`.

- **Style guidance specific to this codebase:**
  - Keep changes small and localized; follow existing imperative DOM manipulation style.
  - Preserve public global function names (see `window.*` usage across files).
  - Prefer using the provided utilities (e.g., `debounceUpdate`, `clearCache`) rather than adding duplicate logic.

- **Safety/operational notes for agents:**
  - Do not assume a bundler or Node tooling exists—there is no `package.json` in the repo root. Any new ES imports must work in the browser or the agent should add a minimal dev server step to the README.
  - Supabase keys are in `config.js` for development; treat them as secrets and warn when modifying.

If anything here is unclear or you'd like more depth on a particular area (routing, auth flows, Supabase schema), tell me which part to expand. 
