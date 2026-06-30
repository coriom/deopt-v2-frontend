#!/usr/bin/env node
// TESTNET-PUBLIC-BETA-LAUNCH-KIT-V1 — option series seeder.
//
// Reads a JSON config file of option-series specs and POSTs each to
// `${BACKEND_URL}/options/series`. The backend is idempotent on the
// canonical `option_series_id` derived from the spec, so re-running
// the seeder against the same DB is safe: existing series are
// returned unchanged. Safe for local testnet beta where
// `OPTIONS_ALLOW_MANUAL_SERIES=true` (the default). Public beta
// closures SHOULD flip `OPTIONS_ALLOW_MANUAL_SERIES=false` after
// initial seed and rely on this script only via an operator-only
// admin route or a one-shot pre-launch bootstrap.
//
// **Safety:**
//   * Read-only by default. The `--apply` flag is required to
//     actually POST. Without it the script DRY-RUNS and prints
//     what it would send.
//   * Refuses to run if `BACKEND_URL` is unset.
//   * Refuses to seed when `CHAIN_ID` env (optional override) is
//     mainnet — the documented testnet chain is Base Sepolia 84532.
//   * Never prints secrets; backend errors are passed through a
//     URL-redacting filter.

import { readFileSync } from "node:fs";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function fail(msg) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

function stripUrls(s) {
  return String(s).replace(/https?:\/\/\S+/g, "<redacted-url>");
}

function parseArgs(argv) {
  const out = { apply: false, configPath: null, backendUrl: null };
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--config") out.configPath = args[++i];
    else if (a === "--backend") out.backendUrl = args[++i];
    else if (a === "--help" || a === "-h") {
      process.stdout.write(
        [
          "Usage: node scripts/seed-options-series.mjs --config <path> [--backend <url>] [--apply]",
          "",
          "Reads <path> (JSON, see scripts/options-series.testnet-beta.json)",
          "and POSTs each entry to <backend>/options/series.",
          "",
          "Without --apply the script prints what it would POST and exits 0",
          "(dry-run). Pass --apply to actually mutate the backend.",
          "",
          "Env:",
          "  BACKEND_URL          (also --backend) target backend base url",
          "  CHAIN_ID             optional; must be 84532 (Base Sepolia) when set",
          "",
          "Refuses any chain id other than 84532. Idempotent: re-running",
          "against the same DB returns the same option_series_id per spec.",
          "",
        ].join("\n"),
      );
      process.exit(0);
    } else fail(`unknown arg: ${a}`);
  }
  if (!out.configPath) fail("--config <path> required");
  out.backendUrl =
    out.backendUrl || process.env.BACKEND_URL || null;
  if (!out.backendUrl) fail("BACKEND_URL env (or --backend) required");
  if (!/^https?:\/\//.test(out.backendUrl)) fail("--backend must be http(s)://...");
  return out;
}

function validateSpec(spec, index) {
  const required = [
    "underlying",
    "base_asset",
    "quote_asset",
    "settlement_asset",
    "expiry",
    "strike_1e8",
    "is_call",
  ];
  for (const key of required) {
    if (spec[key] === undefined || spec[key] === null || spec[key] === "") {
      fail(`spec[${index}] missing required field "${key}"`);
    }
  }
  if (typeof spec.expiry !== "number") {
    fail(`spec[${index}].expiry must be a unix-seconds number`);
  }
  if (typeof spec.is_call !== "boolean") {
    fail(`spec[${index}].is_call must be boolean`);
  }
  if (typeof spec.strike_1e8 !== "string") {
    fail(`spec[${index}].strike_1e8 must be a stringified integer`);
  }
}

async function main() {
  const { apply, configPath, backendUrl } = parseArgs(process.argv);

  const chainOverride = process.env.CHAIN_ID;
  if (chainOverride !== undefined && chainOverride !== "" && chainOverride !== "84532") {
    fail(`CHAIN_ID env override ${chainOverride} is not 84532 (Base Sepolia)`);
  }

  let configRaw;
  try {
    configRaw = readFileSync(configPath, "utf8");
  } catch (err) {
    fail(`cannot read config ${configPath}: ${stripUrls(err)}`);
  }
  let config;
  try {
    config = JSON.parse(configRaw);
  } catch (err) {
    fail(`config ${configPath} is not valid JSON: ${stripUrls(err)}`);
  }
  if (!Array.isArray(config.series)) {
    fail(`config ${configPath} must contain "series": [...]`);
  }

  process.stdout.write(
    [
      `seed-options-series ${apply ? "APPLY" : "(dry-run)"}`,
      `backend:   ${backendUrl}`,
      `config:    ${configPath}`,
      `entries:   ${config.series.length}`,
      "",
    ].join("\n"),
  );

  // Pre-flight: read /health + /ready before mutating.
  if (apply) {
    const health = await fetch(`${backendUrl}/health`).catch((err) => fail(`/health unreachable: ${stripUrls(err)}`));
    if (!health.ok) fail(`/health returned ${health.status}; aborting`);
    const ready = await fetch(`${backendUrl}/ready`).catch((err) => fail(`/ready unreachable: ${stripUrls(err)}`));
    if (!ready.ok) fail(`/ready returned ${ready.status}; aborting`);
    process.stdout.write("/health + /ready both OK; proceeding with apply.\n\n");
  }

  let created = 0;
  let already = 0;
  for (let i = 0; i < config.series.length; i += 1) {
    const spec = config.series[i];
    validateSpec(spec, i);
    const summary = `${spec.underlying} ${spec.is_call ? "CALL" : "PUT"} strike=${spec.strike_1e8} expiry=${spec.expiry}`;
    if (!apply) {
      process.stdout.write(`[dry-run ${i + 1}/${config.series.length}] ${summary}\n`);
      continue;
    }
    const res = await fetch(`${backendUrl}/options/series`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spec),
    });
    const bodyText = await res.text();
    let body;
    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      body = { raw: bodyText };
    }
    if (res.status !== 200 && res.status !== 201) {
      fail(`seed[${i}] (${summary}) → ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
    }
    const seriesId = body && (body.option_series_id || body.id);
    if (!seriesId) fail(`seed[${i}] response missing series id`);
    process.stdout.write(`[apply ${i + 1}/${config.series.length}] ${summary} → ${seriesId}\n`);
    if (body.created_at_ms === body.updated_at_ms) created += 1;
    else already += 1;
  }

  if (apply) {
    process.stdout.write(
      `\nseed complete. created≈${created} reused≈${already} (idempotent — exact split estimated from create/update timestamps).\n`,
    );
  } else {
    process.stdout.write(
      "\ndry-run complete. Re-run with --apply to actually POST.\n",
    );
  }
}

main().catch((err) => fail(`unhandled: ${stripUrls(err)}`));

// Silence eslint when ADDRESS_RE isn't referenced at runtime (kept for
// future spec validation extensions, e.g. on-chain product address).
void ADDRESS_RE;
