# Frontend evolution — implementation record

## Workspace and scope
Isolated checkout: `A:\AiSathi\official-frontend`, detached from `f060831`. Founder checkout is clean on main and remains untouched. No commits, pushes, migrations, or API changes are authorized by this task.

## Direction
Concept 01 (Milky Way Gateway) is primary: plum ground, coral action, lavender secondary accent, bold bilingual typography, restrained particles on the homepage only. Concept 02 offers useful connected states; Concept 09 provides a quieter developer-console influence. Concept 03 is more theatrical, 04 adds unnecessary WebGL cost, 05 conflicts with the requested dark palette, and 06 is too sparse for everyday product work. Preserve existing React/Tailwind components. The spiral is decorative; provider counts come exclusively from the catalogue. No WebGL or additional animation dependency.

## Route inventory and integration map
- `/`: public homepage, existing; replace conflicting model/price claims with catalogue/pricing destinations.
- `/models`: search/filter catalogue; `/api/v1/models`, existing server/client loading.
- `/docs`: existing developer reference and copy controls.
- `/login`: existing email/password, signup and Google via Supabase and `/api/signup`; credentials required for integration testing.
- `/playground`: existing chat history, streaming, model selection, retry/stop, attachments, artifacts and language selection. Uses the gateway, Supabase chat sync, and browser conversation state.
- `/account`: profile display, sign-out, key list/create/revoke via `/api/keys` and Supabase JWT.
- `/dashboard`: account usage via `/api/account/usage`, key-based usage via `/api/v1/me`.
- `/topup`: plan catalogue, Khalti initiate/verify, Stripe checkout; never infer settlement from redirect parameters.
- `/admin`: existing restricted metrics/feedback/draw endpoints; preserve server authorization.
- `/share/[id]`: existing public chat snapshot; requires backing data.
- `/privacy`, `/terms`, not-found: existing informational views.
- `/app` is mentioned in README but has no route in this checkout; do not invent an independent app.

## Implementation checklist
- [x] Inspect repository state, instructions, manifests, routes, concept palettes and interaction architecture.
- [x] Create isolated checkout; preserve existing work.
- [x] Establish consistent tokens and public/application navigation.
- [x] Refine homepage and decorative galaxy.
- [x] Refine internal page surfaces and frontend feedback.
- [x] Run available checks; record limitations below.

## Boundaries
No .env.local or service credentials were supplied. Auth, paid inference, database-backed history, payment settlement, admin and key mutations cannot be claimed live-verified. Existing browser-persisted API-key behavior is an inherited security concern requiring coordinated treatment across account, playground and top-up; do not silently change one caller.

Read the installed Next.js 16.2.10 guides for Server and Client Components and CSS after dependency installation completed; official guides were consulted while installation was pending. Existing framework and conventions retained.

## What changed
- Shared `evolution.css` extends existing semantic tokens; no framework conversion or dependencies added. Existing light-theme opt-in remains dormant.
- `Brand`, `Nav`: original vector mark, consistent lockup, mobile menu/Escape/focus return, current-route and workspace navigation.
- Homepage: Milky Way canvas with DPR/frame limits, visibility suspension, pointer depth, responsive density and live reduced-motion handling. Warm core/plum/violet composition continues through provider cards, API/pricing/FAQ/closing sections. The spiral is decorative, not live traffic. Brand remains visible without canvas.
- Catalogue: real vendor counts only; no historical fallback claims; explicit loading/unavailable state; accessible search/filter and mobile price labels.
- Chat: token-based sidebar, dynamic viewport height, larger labeled composer, visible keyboard/touch history actions, nonoverlapping language controls, model picker search/Escape/focus return and visual-viewport height cap.
- Account: original key endpoint retained; loading/errors/finally handling, copy feedback, explicit revoke confirmation, responsive table and one-time-key panel preservation when a different key is revoked.
- Billing: no settlement claims based on redirect strings; loading/empty/error plan states, masked key input, amount limits and pressed market/preset controls.
- Dashboard: masked key input and clearing displayed data on sign-out. Login uses shared mark and atmospheric background.
- Docs, admin, policy and shared-conversation screens retain existing content/services and receive tokens, navigation and skip targets. These are shared-system refinements, not new implementations of their underlying features.
- Global loading/error recovery and keyboard skip link. No API routes, server libraries, database schema, auth contracts or package manifests changed.

## Verification and limits (2026-10-29)
- `npm run build`: passed, all 39 static pages generated. Existing middleware-to-proxy deprecation warning remains. Initial sandbox font fetch failed; permitted network build succeeded.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- Focused ESLint on new/replaced components, homepage, account and model table: zero errors; final warning cleanup performed.
- Full `npm run lint`: failed with existing repository issues (including minified vendored assets). App/components/lib subset had 29 errors; linting the original HEAD versions established the same counts per affected file. See `lint-comparison.json`. No claim of a clean repository lint gate.
- `git diff --check`: passed (Git prints Windows line-ending conversion notices).
- Export comparison: package, homepage, playground, account and key API entries match HEAD after line-ending normalization; see `export-comparison.json`.
- Browser: homepage renders with working spiral and catalogue. Widths 360, 390, 768, 1024, 1280, 1440 had no horizontal document overflow. Desktop/mobile screenshots inspected.
- Browser interactions: mobile menu and Escape/focus return; FAQ expansion; copy button reported Copied; chat model selected `openrouter/free`, search empty state, Escape dismissal, message entry enabling Send; catalogue search empty state and Free filter; billing market switch/empty plan state. No paid request or payment initiated.
- Browser route views checked: homepage, playground, models, login, account, dashboard, docs, topup, admin, privacy, terms and missing shared-chat view. Login/account correctly expose unconfigured authentication in this local environment. No successful authenticated/admin/payment transaction is claimed.
- Independent review found key-panel clearing and short-screen picker issues; both corrected. Short-screen 360x400 picker inspected within viewport. Actual phone software keyboard not tested.
- Console error inspection on homepage and chat returned no errors during those checks. Initial 127.0.0.1 dev HMR origin warning was avoided by using localhost.
- Reduced-motion/hidden-tab cleanup reviewed in code; OS preference switching and device-throttled performance were not runtime-tested. No WebGL dependency.
- No automated test script exists in package.json. No credential-dependent seeding scripts were run.

## Run and review
Use Node and the existing lockfile in this isolated checkout:
```powershell
cd A:\AiSathi\official-frontend
npm ci
npm run dev -- --port 3012
```
Review http://localhost:3012 (the older static prototype on 3010 is a different preview).
Production check: `npm run build`; `npm start -- --port 3012` after stopping the dev server.

## Before production integration
1. Supply authorized staging environment settings from `.env.example`: Supabase public URL/anon key and server service role; upstream key for inference; Khalti sandbox secret/base URL; Stripe test secret/webhook secret; site URL and existing FX/margin settings. Do not commit secrets or enable the dev bypass key in production.
2. Verify signup/password/Google/recovery, authenticated history and streaming, stop/retry, attachments, key creation/revocation, account usage, payment callbacks/webhook settlement, admin permissions and real shared conversations in staging. These were not available locally.
3. Resolve inherited API-key persistence: account/playground/topup still share plaintext `nepalai_key` in localStorage. A coordinated session-authenticated chat/gateway or ephemeral credential design is needed before claiming secure production key handling. This frontend pass does not silently change the existing gateway contract.
4. Reconcile inherited promotional/legal/preset copy with product owners (including unlimited-chat wording and the prize promotion). Public homepage no longer repeats unverified fixed counts/prices.
5. Resolve baseline lint debt and finish assistive-technology, actual-device keyboard and performance testing. This is a reviewable frontend evolution, not a production security certification.

## Changed-file inventory
See `changed-files.txt` for the final list. Primary implementation: `app/evolution.css`, `app/page.tsx`, `components/{Brand,Nav,HeroGalaxy,ModelPaper,CopyButton}.tsx`; targeted refinements in the route files listed there.

## Living universe implementation — 2026-10-30

The earlier design confined the galaxy to the hero, used flat opaque route backgrounds, and offered little pointer or CTA feedback. This pass retains the information architecture and real integrations while replacing that visual treatment.

- `Universe` mounts once in the root layout: pre-rendered nebula dust, layered stars, pointer depth, native-pointer companion light and context-sensitive ring. Forms and text remain stationary. The decoration never intercepts pointer events.
- `HeroGalaxy` adds softly illuminated stellar dust to the projected spiral, retains the supplied vector mark, and suspends its loop when offscreen. `BrandMark` centralizes the real asset for header, hero and closing destination.
- `PortalLink` is a real Next link to `/playground`, with travelling perpendicular optical rays, surface reflection, keyboard-focus activation, hover depth and press feedback. No authentication flow is simulated.
- `CosmicJourney` coordinates ornament entrances and bounded scroll depth. SVG transmission paths run only while their chapter is visible. The hero, model destinations, staggered workspace panels, connected steps, developer panel, calm credits section and orbital closing each receive a distinct treatment.
- Chat receives a quieter ambient frame, an orbital empty state, illuminated composer, readable code surfaces and a layered model selector. Account, usage, credits, catalogue, docs, login and admin use the same environment and restrained workspace surfaces. Existing profile, billing, history and API-key logic remains in place; there is no new settings route.
- Removed unsupported unlimited-chat wording from the trial prompts. Current model/plan values still come from the existing services.
- Added only the exact loopback `127.0.0.1` to Next's development-origin list because the user's preview uses that address. Production headers and API behavior remain unchanged.

### Verification of this pass
- Final production build passed: TypeScript plus all 39 static pages. Existing middleware deprecation warning remains.
- TypeScript standalone and focused ESLint on new motion/brand components, homepage and layout passed.
- Eight lifecycle checks in `scripts/motion-lifecycle.test.cjs` pass. They exercise the actual effect bodies with canvas/DOM adapters: stable fallback rendering with zero scheduled ambient frames for reduced motion, mobile and lower-core devices; single-loop scheduling; visibility suspension; live reduced-motion changes; listener/frame cleanup. These are lifecycle checks, not a physical-device performance benchmark.
- Browser verified: pointer movement changes position and interactive state without hiding the native cursor; keyboard focus activates `cross-glint` with perpendicular rays; Start chatting navigates to the actual playground; menu Escape/focus return; scroll-depth updates; FAQ expansion; exact copied cURL content; model search/selection; message entry enables Send; catalogue filters and empty search; billing market switching; account/login/admin access guards.
- Homepage checked at 360, 390, 768, 1024 and 1440 px with no horizontal document overflow. Mobile chat and docs inspected. Fixed a decorative pseudo-element causing chat overflow and an isolated stacking context concealing the mobile model picker.
- Contrast checks led to darker coral action surfaces, white portal labels and a brighter separate text-accent token. Body copy remains above 7:1 on the raised surface; textual coral is above 9:1 on the base card surface.
- No WebGL dependency, new package, backend change, or fabricated authenticated result. Canvas rendering is capped at approximately 20 fps (shared environment) / 30 fps (hero), DPR capped, and static on small/coarse-pointer/lower-core devices or reduced motion.

### Remaining verification limits
Supabase authentication is not configured in this local deployment. Successful sign-in, authenticated streaming/history, key mutations, payments/settlement and admin actions remain untested. No inference or payment was initiated during verification. OS-level reduced-motion switching, physical phone keyboards, assistive technology and throttled-device performance remain outside the checks performed. Repository-wide lint still has the previously documented inherited failures. The existing API-key persistence and promotional/legal-copy follow-ups above still apply; the unlimited-chat text in the playground has now been corrected.

Final preview check: `http://127.0.0.1:3012/` loads fonts and all original-mark images, has no horizontal overflow at 1440 px, and reports no console errors in the captured session. Its Start chatting link also reaches `/playground`; the composer is visible and that route reports no captured console errors. Screenshots: `living-universe-desktop.png` and `living-universe-chat.png`. Temporary browser viewport overrides were reset after verification. Standalone TypeScript and diff whitespace checks also passed after the development-origin configuration change.
