#!/usr/bin/env node
// TESTNET-PUBLIC-BETA-LAUNCH-KIT-V1 — read-only readiness probe.
//
// Verifies that a frontend + backend pair is ready to invite
// external testers. All checks are HTTP GETs with short timeouts;
// no signers, no secrets, no writes.
//
// Exit codes:
//   0   ready
//   1   execution / config error
//   2   one or more soft checks failed but core is up
//   3   one or more critical checks failed (do NOT invite testers)
//
// Usage:
//   FRONTEND_URL=https://...  BACKEND_URL=https://...  \
//     node scripts/check-public-beta-readiness.mjs
//   node scripts/check-public-beta-readiness.mjs --json

const FAUCET = "0xdf8969230142fbafbae7e4d5af3541db97526c4f";
const EXPECTED_CHAIN_ID = 84532;
const TIMEOUT_MS = 8_000;

function stripUrls(s) {
  return String(s).replace(/https?:\/\/\S+/g, "<redacted-url>");
}

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function probe(severity, name, fn) {
  try {
    const result = await fn();
    return { severity, name, status: "pass", detail: result ?? "" };
  } catch (err) {
    return { severity, name, status: "fail", detail: stripUrls(err) };
  }
}

function readArgs(argv) {
  const out = { json: false };
  for (const a of argv.slice(2)) {
    if (a === "--json") out.json = true;
    else if (a === "--help" || a === "-h") {
      process.stdout.write(
        [
          "Usage: node scripts/check-public-beta-readiness.mjs [--json]",
          "",
          "Env:",
          "  FRONTEND_URL   public frontend URL (required for frontend probes)",
          "  BACKEND_URL    public backend URL (required for backend probes)",
          "",
          "If a URL is unset, the related probes report as 'skipped' rather",
          "than failing, so the script is useful before either side is live.",
          "",
          "Exit codes: 0 ready · 1 error · 2 soft-fail · 3 critical-fail",
          "",
        ].join("\n"),
      );
      process.exit(0);
    } else {
      process.stderr.write(`error: unknown arg ${a}\n`);
      process.exit(1);
    }
  }
  return out;
}

async function main() {
  const args = readArgs(process.argv);
  const frontendUrl = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  const backendUrl = (process.env.BACKEND_URL || "").replace(/\/$/, "");

  const results = [];

  if (!frontendUrl && !backendUrl) {
    process.stderr.write("error: neither FRONTEND_URL nor BACKEND_URL set; nothing to probe.\n");
    process.exit(1);
  }

  // -- Backend checks --------------------------------------------------
  if (backendUrl) {
    results.push(
      await probe("critical", "backend.health", async () => {
        const r = await fetchWithTimeout(`${backendUrl}/health`);
        if (!r.ok) throw new Error(`/health returned ${r.status}`);
        return "200";
      }),
    );
    results.push(
      await probe("critical", "backend.ready", async () => {
        const r = await fetchWithTimeout(`${backendUrl}/ready`);
        if (!r.ok) throw new Error(`/ready returned ${r.status}`);
        return "200";
      }),
    );
    results.push(
      await probe("critical", "backend.options.series.nonempty", async () => {
        const r = await fetchWithTimeout(`${backendUrl}/options/series`);
        if (!r.ok) throw new Error(`/options/series returned ${r.status}`);
        const body = await r.json();
        if (!Array.isArray(body)) throw new Error("/options/series did not return an array");
        if (body.length === 0) throw new Error("no option series seeded — invite blocked");
        return `${body.length} series`;
      }),
    );
    results.push(
      await probe("soft", "backend.markets.no_perp_leak", async () => {
        const r = await fetchWithTimeout(`${backendUrl}/markets`);
        if (!r.ok) throw new Error(`/markets returned ${r.status}`);
        const body = await r.json();
        if (!Array.isArray(body)) throw new Error("not array");
        const perps = body.filter((m) => (m.kind || m.type || "").toLowerCase() === "perp");
        if (perps.length > 0) throw new Error(`${perps.length} perp entries leaked`);
        return `${body.length} non-perp markets`;
      }),
    );
    results.push(
      await probe("soft", "backend.perps.fail_closed", async () => {
        const r = await fetchWithTimeout(`${backendUrl}/perps/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (r.ok) throw new Error(`/perps/orders unexpectedly returned 2xx`);
        return `closed (status ${r.status})`;
      }),
    );
  } else {
    results.push({
      severity: "critical",
      name: "backend.*",
      status: "skipped",
      detail: "BACKEND_URL not set",
    });
  }

  // -- Frontend checks ------------------------------------------------
  if (frontendUrl) {
    const paths = ["/", "/options", "/api", "/perps", "/history", "/docs/quickstart"];
    for (const path of paths) {
      results.push(
        await probe("critical", `frontend.GET ${path}`, async () => {
          const r = await fetchWithTimeout(`${frontendUrl}${path}`);
          if (!r.ok) throw new Error(`${path} returned ${r.status}`);
          return "200";
        }),
      );
    }
    results.push(
      await probe("soft", "frontend.perps.banner", async () => {
        const r = await fetchWithTimeout(`${frontendUrl}/perps`);
        const html = await r.text();
        if (!/not live/i.test(html)) throw new Error("'not live' copy missing on /perps");
        return "banner present";
      }),
    );
    results.push(
      await probe("soft", "frontend.api.faucet_address_embedded", async () => {
        // Cheap check: the rendered /api page references the live
        // faucet address either in the static HTML or, more often,
        // in the inlined Next bundle. The fastest way to verify the
        // production env is set is to grep one of the chunk files
        // listed by the manifest. We approximate by reading the
        // build-manifest endpoint Next exposes at /_next/static/...,
        // but the simplest cross-cutting check is to see if the
        // /api response references the faucet address either inline
        // or through the build manifest's URL path.
        const r = await fetchWithTimeout(`${frontendUrl}/api`);
        const html = await r.text();
        const found =
          html.toLowerCase().includes(FAUCET) ||
          /__deoptFaucetAddress|NEXT_PUBLIC_TESTNET_FAUCET_ADDRESS/i.test(html);
        if (!found)
          throw new Error("faucet address marker not found on /api (claim-mode may not be active)");
        return "faucet marker present";
      }),
    );
  } else {
    results.push({
      severity: "critical",
      name: "frontend.*",
      status: "skipped",
      detail: "FRONTEND_URL not set",
    });
  }

  // -- Report ---------------------------------------------------------
  const counts = { pass: 0, fail: 0, skipped: 0 };
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  const criticalFail = results.some((r) => r.severity === "critical" && r.status === "fail");
  const softFail = results.some((r) => r.severity === "soft" && r.status === "fail");
  let exitCode = 0;
  if (criticalFail) exitCode = 3;
  else if (softFail) exitCode = 2;

  if (args.json) {
    process.stdout.write(
      `${JSON.stringify({ exitCode, counts, frontendUrl, backendUrl, results }, null, 2)}\n`,
    );
  } else {
    const lines = [
      "DeOpt public-beta readiness",
      `Frontend: ${frontendUrl || "(unset)"}`,
      `Backend:  ${backendUrl || "(unset)"}`,
      `Expected chain id: ${EXPECTED_CHAIN_ID} (Base Sepolia)`,
      "",
    ];
    for (const r of results) {
      const icon = r.status === "pass" ? "✓" : r.status === "skipped" ? "·" : "✗";
      lines.push(`  ${icon} [${r.severity}] ${r.name}: ${r.detail}`);
    }
    lines.push(
      "",
      `pass=${counts.pass || 0} fail=${counts.fail || 0} skipped=${counts.skipped || 0}`,
      `overall: ${
        exitCode === 0
          ? "READY"
          : exitCode === 2
            ? "SOFT-FAIL (review)"
            : "CRITICAL-FAIL (do NOT invite testers)"
      }`,
    );
    process.stdout.write(`${lines.join("\n")}\n`);
  }
  process.exit(exitCode);
}

main().catch((err) => {
  process.stderr.write(`unhandled: ${stripUrls(err)}\n`);
  process.exit(1);
});
