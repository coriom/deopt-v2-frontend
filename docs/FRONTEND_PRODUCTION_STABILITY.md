# DeOpt frontend production acceptance

## Release sequence

1. From a clean `main` worktree, run `npm run lint -- --quiet`,
   `npm run typecheck`, `npm run build`, and `npm run test:node`.
2. Start the production build locally and run the focused Playwright suite in
   `.github/workflows/frontend-ci.yml`. Do not use a live wallet or backend.
3. Commit and push normally. Confirm that Vercel creates a **Production**
   deployment from the pushed SHA. Check READY, the canonical alias, and
   deployed Git SHA. GitHub CI repeats the build and local browser checks; its
   result is evidence, not a pre-deployment gate for Vercel's automatic build.
4. In an authenticated browser, check Home, Options, Perps, Wallet disconnected,
   Workspace, route transitions and reloads. Confirm trading is unavailable and
   that the first-party console has no uncaught exceptions. Record third-party
   widget and wallet-extension errors separately.
5. Query Vercel runtime errors and the **most recent 30 minutes** of runtime
   logs. Empty server logs alone do not prove the browser is healthy.
6. If a critical regression appears, stop promotion and use Vercel's reviewed
   rollback to the prior deployment. Recheck the canonical alias afterward.

The canonical production URL is `https://deoptv2-frontend.vercel.app`.
Vercel project metadata reports authentication protection, but a fresh
unauthenticated Chromium session reached the current production alias during
this review. Treat the served response as the authority for each release. If
the site is protected for a future run, report live browser acceptance as
**blocked**; do not use a share link or change protection.

## Client diagnostics

`src/instrumentation-client.ts` observes first-party uncaught errors,
unhandled Error rejections, and failed first-party Next static assets.
`src/app/error.tsx` and `src/app/global-error.tsx` report React boundary
failures and offer a retry. Hydration failures are classified when they surface
as an error; nonfatal console-only hydration warnings are not captured.

Only a fixed record is sent: category, allowlisted error type and source,
top-level route group, release SHA, timestamp, coarse browser family, and a
non-user fingerprint. Messages, stacks, raw URLs, wallet data and storage are
never sent. The request omits cookies and referrer. Third-party widget and
extension errors are filtered by origin where identifiable. Diagnostic delivery
failure never blocks the app.

`POST /api/client-errors` checks same-origin request metadata, accepts only a
fixed schema of at most 512 bytes, and caps accepted reports at 30 per minute
per function instance. The browser also deduplicates fingerprints and limits
reports per page. Only validated fixed fields reach the server log. The limit is
not global across Vercel instances, and Hobby runtime-log retention is short.
The endpoint cannot be treated as durable telemetry or a security audit log.

Diagnostic requests deliberately omit cookies. If Vercel Authentication
protects the URL for a future run, the protection layer may reject delivery.
Do not weaken authentication or create a bypass link to make the collector
work. Check an actual production-browser synthetic report and the matching
Vercel log before classifying monitoring as ACTIVE.

For a safe synthetic check in an authorized browser console:

```js
window.dispatchEvent(new ErrorEvent("error", {
  error: new TypeError("synthetic monitoring check"),
  filename: location.origin + "/_next/static/chunks/synthetic.js",
}));
```

The expected server record has `type: TypeError` and the current route group,
with no text from the synthetic message. A missing record means delivery is
unverified or blocked; it does not justify adding a secret or disabling SSO.
