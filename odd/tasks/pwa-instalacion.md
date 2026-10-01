# PWA install layer: manifest, static head, breakpoint and CI (fix/pwa-instalacion)

**Opened:** 2026-09-30 · **Branch:** `fix/pwa-instalacion` (from `main`) · **Status:** closed — A, B and C closed with approved native reviews

## Objective

Close the third and final audit unit of the PWA/mobile audit (2026-09-29): make the
install layer of the PWA correct (manifest + static head + Apple meta), align the
notification-menu breakpoint with the rest of the app, and run Mobile Chrome in CI.

## Audit findings that motivate it

- `public/manifest.json` — icons only `purpose:"any"` (lines 15, 21, 27), no maskable
  icon; no `lang`, no `orientation`; no `apple-touch-icon` anywhere.
- No `app/+html.tsx` → Expo Router default shell ships `lang="en"`, viewport without
  `viewport-fit=cover`, and no Apple meta tags. Runtime `ensureWebHead()`
  (`app/_layout.tsx:20-53`) compensates only after JS hydration, never during static export.
- `scripts/postbuild.cjs:29-32` injects relative `./favicon.ico` / `./manifest.json`
  into both `index.html` and `404.html`; on deep routes served via `404.html` they
  resolve wrong until hydration. `injectHtmlLangIfHtmlExists` is dead code (the default
  shell already has `lang="en"`, so its guard matches and it does nothing).
- `components/NotificationMenu.tsx:25-26` — `isDesktopViewport()` uses
  `innerWidth >= 640` while the whole app uses `width > 768` (`ResponsiveLayout.tsx:35`
  and 5 more call sites). Mismatch band 640–768px. Zero tests for this component.
- `.github/workflows/e2e.yml:35,64` — CI installs and runs only `chromium`, while
  `playwright.config.ts` defines 5 projects incl. Mobile Chrome (Pixel 5).

## Decisions

- **Head split by capability:** `app/+html.tsx` owns *meta tags only* (`lang="es"`,
  `viewport-fit=cover`, Apple meta). All *hrefs* (favicon, manifest, apple-touch-icon)
  stay in `scripts/postbuild.cjs`, made base-aware from `app.json`
  `experiments.baseUrl` at build time. Rationale: `getGithubPagesBasePath()` returns
  `''` at static-render time (no `window`), and `process.env.EXPO_BASE_URL` is also set
  in dev, so absolute hrefs in `+html.tsx` would break `expo start --web`. Postbuild
  knows the real deployment base and runs only on export.
- **One injection mechanism:** postbuild injects the same idempotent
  `data-murodeseos-pwa` link block into `index.html` and `404.html` with base-aware
  hrefs; `ensureWebHead()` keeps only its runtime idempotent rewrite for dev/SSR and
  must not duplicate tags already present.
- **Fix the dead lang injection** by dropping it from postbuild (`lang` moves to
  `+html.tsx`, which beats the default shell's `lang="en"`).
- **Maskable icon is a real padded asset**, not a relabel of the full-bleed 1024.png
  (maskable requires ~40% safe zone). Generate once and commit the PNG; no icon
  tooling is added to the repo.
- **Breakpoint:** single shared source of truth (`> 768`, matching
  `useWindowDimensions` call sites and Tailwind `md:`). Minimal change preferred over
  a new shared hook unless the hook is trivial.
- **CI:** extend the existing job to re-seed and run Mobile Chrome as a *separate
  Playwright invocation* (E-10: the suite is not self-cleaning, so two projects on one
  seed contaminate each other). Mobile Safari/WebKit stays out (needs a new browser
  install; separate decision). Add failure artifact upload for `playwright-report/`.

## Work units / tasks

### Unit A — PWA install metadata (manifest + static head + postbuild) — **CLOSED** ✅

| # | Task | Status |
| --- | --- | --- |
| A1 | `app/+html.tsx` (new): meta-only head | **hecho** |
| A2 | `scripts/postbuild.cjs`: base-aware `data-murodeseos-pwa` injection; remove dead lang injection | **hecho** |
| A3 | `app/_layout.tsx`: reconcile `ensureWebHead()` | **hecho** |
| A4 | Assets + `public/manifest.json`: maskable 512, apple-touch-icon 180, lang, orientation | **hecho** |
| A5 | Tests + docs | **hecho** |

- Commit `bf06024` — `feat(pwa): add static install metadata and base-aware head links`.
- Independent verifier: FAIL → 1 blocking defect (`normalizeBasePath('/')` → `//x`)
  fixed + `'/'` test added; `scripts/README.md:26` stale line updated. Re-verified green
  (172 tests, typecheck, lint).
- Native RDD review `review-595207f205edd093` — tier medio, lente fiabilidad, **aprobada**,
  autoridad quemada. 4 informativos no bloqueantes: R3-001 (`scripts/postbuild.cjs:54`),
  R3-002 (`__tests__/postbuild.test.ts:62-67`), R3-003 (`__tests__/postbuild.test.ts:1-79`),
  R3-004 (`app/+html.tsx:8`).

### Unit B — NotificationMenu breakpoint consistency

| # | Task | Status |
| --- | --- | --- |
| B1 | `components/NotificationMenu.tsx`: `isDesktopViewport()` → `> 768` (shared convention) | pending |
| B2 | Tests: new `__tests__/NotificationMenu.test.tsx`; extend `vitest.setup.ts` supabase mock with `channel/on/subscribe` if needed | pending |
| B3 | Docs: breakpoint convention note | pending |

### Unit C — Mobile Chrome in CI — **CLOSED** ✅

| # | Task | Status |
| --- | --- | --- |
| C1 | `.github/workflows/e2e.yml`: re-seed + run `--project="Mobile Chrome"` separate; upload artifacts on failure; timeout 30→60 | **hecho** |
| C2 | Docs: `## 🧪 Testing` — which projects CI runs and why (E-10 rationale) | **hecho** |

- Commit `564ce6f` — `ci(e2e): run Mobile Chrome with per-project re-seed and failure artifacts`.
- Independent verifier: PASS 8/8; flagged the 30-min timeout (raised to 60 by parent).
- Native RDD review `review-a607e1ddc7a6f75c` — tier ALTO, 4 lenses
  (risk/resilience/readability/reliability), **aprobada**, autoridad quemada. 7 informativos
  no bloqueantes: R2-001/002/003, R3-001/002, R4-001/002.
- Operational notes: the accumulated candidate (A+B+C over `main`) first hit a native
  `operation_timeout` on the 4-lens group and later a `reviewer-empty-output` on the
  `review-resilience` lens (both non-consuming). The stuck lineage was quarantined via
  audited `gentle-ai review abandon` (user-authorized); a fresh transaction completed by
  submitting the four lenses one slot at a time.

## Verification

- Unit A: writer self-verification + independent verifier + native RDD review (approved). ✅
- Unit B: writer self-verification + independent verifier + native RDD review (approved). ✅
- Unit C: writer self-verification + independent verifier + native RDD review (approved). ✅

## Commits

- `bf06024` — feat(pwa): add static install metadata and base-aware head links (Unit A).
- `353bc24` — fix(pwa): align NotificationMenu breakpoint with app-wide >768 convention (Unit B).
- `564ce6f` — ci(e2e): run Mobile Chrome with per-project re-seed and failure artifacts (Unit C).
