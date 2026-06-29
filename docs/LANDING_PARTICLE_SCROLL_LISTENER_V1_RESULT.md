# LANDING-PARTICLE-SCROLL-LISTENER-V1 — result

**Status: CLOSED.**

The landing particle field now reacts to the real scroll container
(the page-mode `<div className="…overflow-y-auto">` in
`TradingShell`) instead of `window`. The last documented Playwright
skip is unskipped and passing. Full suite: **306 passed / 0 skipped /
0 failed**.

---

## Root cause

The trading layout (`src/app/(trading)/layout.tsx`) wraps everything
in `<div className="flex h-dvh min-h-0 flex-col overflow-hidden …">`.
On non-terminal routes (including `/`), `TradingShell` mounts a
second wrapper `<div className="flex min-h-0 flex-1 flex-col
overflow-y-auto">` — and **that** wrapper is the real scroll source.
`window` itself never scrolls under this layout.

`ParticleField` was binding its scroll listener (and reading
`window.scrollY` for parallax) to `window`. The handler never fired,
`scrollProgress` stayed at `0`, and `pickMode(0)` always returned
`calm` — leaving the test
`landing-product-v2.spec.ts › particle mode morphs across scroll
progress` unreachable from a real user gesture and `test.skip`'d
until this milestone.

---

## Actual scroll source

`TradingShell.tsx` page-mode branch, tagged in this milestone with:

```tsx
<div
  data-testid="page-scroll-container"
  data-scroll-container="page"
  className="flex min-h-0 flex-1 flex-col overflow-y-auto"
>
```

The `data-scroll-container="page"` attribute is the contract; the
testid is a convenience for Playwright to target the same element
without coupling to internal DOM names.

Terminal routes (`/options`, `/perps`, `/history`, …) stay in the
existing `overflow-hidden` `<main>` branch — they don't render
`ParticleField` and don't need a scroll container.

---

## Implementation strategy

`ParticleField.tsx`:

1. **Discover the scroll source once at mount.** A small
   `findScrollSource(start: HTMLElement | null): HTMLElement | Window`
   helper walks the parent chain from the field's root looking for
   the first element with `data-scroll-container`. If none is found,
   it returns `window` — preserving the original behaviour for any
   isolated landing render (Storybook-style harness, etc.).
2. **Read progress + raw position via a shared helper.**
   `readScrollPosition(source)` returns `{ y, progress }` computed
   from either `window.scrollY` / `documentElement.scrollHeight -
   innerHeight` or the element's `scrollTop` / `scrollHeight -
   clientHeight`. One code path covers both sources.
3. **Replace every `window.scrollY` read.** Inside `onScroll` and
   each `frame()`'s parallax-drift computation. `lastScrollY` is
   initialised from the resolved source's position at mount.
4. **Bind the scroll listener on the resolved source.** `Element`
   and `Window` share `addEventListener` / `removeEventListener` so
   cleanup is symmetrical without branching.
5. **Surface stable observable state.** The field root now carries
   `data-scroll-source` (`"window"` | `"container"`) so tests can
   pin that the real container was discovered, and
   `data-scroll-progress` (3-decimal string) so they can assert
   numeric progress motion as well as discrete mode changes.

No timers, no fake state, no listener leak (the cleanup unbinds the
source-scoped scroll listener as well as the window-scoped pointer
listeners). SSR-safe: the `findScrollSource` no-op short-circuit
returns `window` if `typeof window === "undefined"`, and DOM access
is gated by the existing `useEffect` boundary.

---

## Files changed

### Modified

* `src/components/landing/ParticleField.tsx` — added
  `findScrollSource` + `readScrollPosition`; effect resolves the
  source, binds the scroll listener there, reads parallax delta from
  it, and exposes `data-scroll-source` + `data-scroll-progress` on
  the field root.
* `src/components/TradingShell.tsx` — tagged the page-mode scroll
  container with `data-testid="page-scroll-container"` and
  `data-scroll-container="page"`. No layout / visual change.
* `tests/e2e/landing-product-v2.spec.ts` — replaced the skipped
  placeholder with a real test that scrolls
  `data-testid="page-scroll-container"` via `evaluate(el =>
  el.scrollTo(…))`, polls `data-particle-mode` for the morph, and
  asserts the round trip restores `calm`.

### New

* `docs/LANDING_PARTICLE_SCROLL_LISTENER_V1_RESULT.md`

---

## Test unskipped

`tests/e2e/landing-product-v2.spec.ts` —
`particle mode morphs across scroll progress (calm → not-calm →
calm)`. Passes via `scroller.evaluate(el => el.scrollTo(…))` (the
native `scrollTo` fires the same `scroll` event the field is now
listening for; a synthetic `dispatchEvent` would be silently
no-op'd because the listener is `{ passive: true }`).

Specifically asserts:

1. `[data-testid="particle-field"]` is attached.
2. `[data-testid="page-scroll-container"]` is attached.
3. `[data-scroll-source="container"]` on the field — proves the
   real container was discovered (not the `window` fallback).
4. `[data-particle-mode="calm"]` at the top.
5. After `scrollTo({ top: scrollHeight })` →
   `[data-particle-mode]` matches `/^(wave|nodes|sparse)$/`.
6. `[data-scroll-progress]` numerically exceeds `0.1`.
7. After `scrollTo({ top: 0 })` → mode returns to `"calm"`.

`expect.poll` covers the natural debounce of the scroll event loop;
no arbitrary `waitForTimeout`.

---

## Validations

| | result |
|---|---|
| `npm run lint` | clean |
| `npx tsc --noEmit` | clean |
| `npm run build` | clean (rebuilt with `NEXT_PUBLIC_TRADING_API_BASE_URL=http://localhost:4010`) |
| `npm run test:node` | **64/64** (no change) |
| `npx playwright test --list` | **306 tests / 47 files** (was 305 + 1 skip placeholder; the placeholder test was rewritten, not added) |
| `npx playwright test` | **306 passed / 0 skipped / 0 failed** |
| `git diff --check` | clean |

Landing spec specifically: **20/20 passed** including the previously
skipped morph test.

---

## Safety

* No backend changes.
* No mainnet. No deployment. No Solidity. No transaction. No broadcast.
* No trading / options / history / write-auth / TP-SL / lifecycle /
  API behaviour change.
* No real keys; no secret in logs, traces or artifacts.
* No perps lifecycle masquerading as live.
* No production mock state — the helper resolves the real DOM source;
  the fallback to `window` matches the original pre-trading-shell
  behaviour and is the only honest thing to do if no scroll container
  is tagged.

---

## Limitations / follow-ups

* The scroll source is resolved **once** at mount. If a future change
  re-parents the particle field into a different scroll container at
  runtime, the listener would still point at the original source.
  Not relevant today (the layout doesn't re-parent landing); easy
  follow-up if needed (re-resolve on `MutationObserver` or via a
  React context that publishes the active scroll container).
* Page-mode scroll container shared across all non-terminal routes
  (`/`, `/feedback`, `/docs/*`, etc.) — they all get the
  `data-scroll-container="page"` tag for free, but only `/` renders
  `ParticleField` so the others are unaffected.

No deferrals. The Playwright skip slot is now empty.
