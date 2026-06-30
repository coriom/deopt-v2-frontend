// TESTNET-FAUCET-RESERVE-MONITOR-V1 — pure-logic tests for the
// reserve monitor library.
//
// Exercises the helpers in `scripts/faucet-reserve-monitor.lib.mjs`
// without any RPC. Kept in lock-step with the lib; if a function's
// behavior changes, this file MUST be updated.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  STATUS_OK,
  STATUS_LOW,
  STATUS_EMPTY,
  EXIT_OK,
  EXIT_LOW,
  EXIT_EMPTY,
  EXIT_ERROR,
  BASE_SEPOLIA_CHAIN_ID,
  DEFAULT_FAUCET_ADDRESS,
  DEFAULT_TOKENS,
  DEFAULT_THRESHOLD_CLAIMS,
  formatTokenAmount,
  computeRemainingClaims,
  classifyStatus,
  aggregateStatus,
  pickBottleneck,
  exitCodeForStatus,
  buildReport,
  formatReportHuman,
  reportToJson,
} from "../../scripts/faucet-reserve-monitor.lib.mjs";

// ---------------------------------------------------------------------------
// formatTokenAmount
// ---------------------------------------------------------------------------

test("formatTokenAmount: 6-decimal token (mUSDC) renders thousands separator", () => {
  // 1,000,000 mUSDC = 1e12 raw (6 decimals)
  assert.equal(formatTokenAmount(1_000_000n * 10n ** 6n, 6), "1,000,000");
  // 1,234.56 mUSDC = 1_234_560_000 raw
  assert.equal(formatTokenAmount(1_234_560_000n, 6), "1,234.56");
});

test("formatTokenAmount: 18-decimal token (mWETH) trims trailing zeros", () => {
  // 1 mWETH = 1e18 raw
  assert.equal(formatTokenAmount(10n ** 18n, 18), "1");
  // 0.5 mWETH = 5e17 raw
  assert.equal(formatTokenAmount(5n * 10n ** 17n, 18), "0.5");
});

test("formatTokenAmount: 8-decimal token (mWBTC) 0.5 → 0.5", () => {
  assert.equal(formatTokenAmount(5n * 10n ** 7n, 8), "0.5");
});

test("formatTokenAmount: 0 balance is '0', not '0.'", () => {
  assert.equal(formatTokenAmount(0n, 6), "0");
});

test("formatTokenAmount: rejects negative + non-bigint", () => {
  assert.throws(() => formatTokenAmount(-1n, 6), /must be >= 0/);
  assert.throws(() => formatTokenAmount(1, 6), /must be bigint/);
});

// ---------------------------------------------------------------------------
// computeRemainingClaims
// ---------------------------------------------------------------------------

test("computeRemainingClaims: exact multiple", () => {
  // 1,000,000 mUSDC reserve / 1,000 mUSDC per claim = 1000
  const reserve = 1_000_000n * 10n ** 6n;
  const perClaim = 1_000n * 10n ** 6n;
  assert.equal(computeRemainingClaims(reserve, perClaim), 1000n);
});

test("computeRemainingClaims: floors (not rounds) on remainder", () => {
  // 999_999 mUSDC / 1_000 mUSDC per claim = 999, not 1000
  const reserve = 999_999n * 10n ** 6n;
  const perClaim = 1_000n * 10n ** 6n;
  assert.equal(computeRemainingClaims(reserve, perClaim), 999n);
});

test("computeRemainingClaims: 0 reserve → 0 claims", () => {
  assert.equal(computeRemainingClaims(0n, 1n), 0n);
});

test("computeRemainingClaims: rejects zero/negative perClaim", () => {
  assert.throws(() => computeRemainingClaims(10n, 0n), /perClaim must be > 0/);
  assert.throws(() => computeRemainingClaims(10n, -1n), /perClaim must be > 0/);
});

// ---------------------------------------------------------------------------
// classifyStatus
// ---------------------------------------------------------------------------

test("classifyStatus: 0 claims left → EMPTY", () => {
  assert.equal(classifyStatus(0n, 100n), STATUS_EMPTY);
});

test("classifyStatus: below threshold → LOW", () => {
  assert.equal(classifyStatus(99n, 100n), STATUS_LOW);
  assert.equal(classifyStatus(1n, 100n), STATUS_LOW);
});

test("classifyStatus: at or above threshold → OK", () => {
  assert.equal(classifyStatus(100n, 100n), STATUS_OK);
  assert.equal(classifyStatus(1000n, 100n), STATUS_OK);
});

test("classifyStatus: threshold of 0 → never LOW (0 = EMPTY, anything else = OK)", () => {
  assert.equal(classifyStatus(0n, 0n), STATUS_EMPTY);
  assert.equal(classifyStatus(1n, 0n), STATUS_OK);
});

// ---------------------------------------------------------------------------
// aggregateStatus
// ---------------------------------------------------------------------------

test("aggregateStatus: all OK → OK", () => {
  assert.equal(aggregateStatus([STATUS_OK, STATUS_OK, STATUS_OK]), STATUS_OK);
});

test("aggregateStatus: any LOW + no EMPTY → LOW", () => {
  assert.equal(aggregateStatus([STATUS_OK, STATUS_LOW, STATUS_OK]), STATUS_LOW);
});

test("aggregateStatus: any EMPTY → EMPTY (beats LOW + OK)", () => {
  assert.equal(aggregateStatus([STATUS_OK, STATUS_LOW, STATUS_EMPTY]), STATUS_EMPTY);
});

test("aggregateStatus: empty array → EMPTY (defensive default)", () => {
  assert.equal(aggregateStatus([]), STATUS_EMPTY);
});

// ---------------------------------------------------------------------------
// pickBottleneck
// ---------------------------------------------------------------------------

test("pickBottleneck: picks the smallest claimsLeft", () => {
  const rows = [
    { symbol: "A", claimsLeft: 500n },
    { symbol: "B", claimsLeft: 100n },
    { symbol: "C", claimsLeft: 300n },
  ];
  assert.equal(pickBottleneck(rows).symbol, "B");
});

test("pickBottleneck: ties keep the first listed", () => {
  const rows = [
    { symbol: "A", claimsLeft: 100n },
    { symbol: "B", claimsLeft: 100n },
  ];
  assert.equal(pickBottleneck(rows).symbol, "A");
});

test("pickBottleneck: empty rows → null", () => {
  assert.equal(pickBottleneck([]), null);
});

// ---------------------------------------------------------------------------
// exitCodeForStatus
// ---------------------------------------------------------------------------

test("exitCodeForStatus mapping", () => {
  assert.equal(exitCodeForStatus(STATUS_OK), EXIT_OK);
  assert.equal(exitCodeForStatus(STATUS_LOW), EXIT_LOW);
  assert.equal(exitCodeForStatus(STATUS_EMPTY), EXIT_EMPTY);
  assert.equal(exitCodeForStatus("garbage"), EXIT_ERROR);
});

// ---------------------------------------------------------------------------
// buildReport — wires it all together against the documented defaults
// ---------------------------------------------------------------------------

test("buildReport: refuses any chain other than 84532", () => {
  assert.throws(
    () =>
      buildReport({
        chainId: 1,
        faucetAddress: DEFAULT_FAUCET_ADDRESS,
        tokens: DEFAULT_TOKENS,
        balances: [0n, 0n, 0n],
        threshold: 0n,
      }),
    /refusing chain id 1/,
  );
  assert.throws(
    () =>
      buildReport({
        chainId: 8453, // Base mainnet
        faucetAddress: DEFAULT_FAUCET_ADDRESS,
        tokens: DEFAULT_TOKENS,
        balances: [0n, 0n, 0n],
        threshold: 0n,
      }),
    /refusing chain id 8453/,
  );
});

test("buildReport: balances/tokens length must match", () => {
  assert.throws(
    () =>
      buildReport({
        chainId: BASE_SEPOLIA_CHAIN_ID,
        faucetAddress: DEFAULT_FAUCET_ADDRESS,
        tokens: DEFAULT_TOKENS,
        balances: [0n, 0n],
        threshold: 0n,
      }),
    /must match tokens length/,
  );
});

test("buildReport: full-reserve state → OK across the board", () => {
  // Activation-state balances per the result doc:
  const fullBalances = [
    1_000_000n * 10n ** 6n, // 1,000,000 mUSDC
    1_000n * 10n ** 18n,    // 1,000   mWETH
    500n * 10n ** 8n,        // 500     mWBTC
  ];
  const report = buildReport({
    chainId: BASE_SEPOLIA_CHAIN_ID,
    faucetAddress: DEFAULT_FAUCET_ADDRESS,
    tokens: DEFAULT_TOKENS,
    balances: fullBalances,
    threshold: DEFAULT_THRESHOLD_CLAIMS,
  });
  assert.equal(report.overallStatus, STATUS_OK);
  assert.equal(report.exitCode, EXIT_OK);
  assert.equal(report.rows.length, 3);
  for (const r of report.rows) {
    assert.equal(r.status, STATUS_OK);
    assert.equal(r.claimsLeft, 1000n);
  }
  assert.equal(report.bottleneck.claimsLeft, 1000n);
  // Tie → first listed wins.
  assert.equal(report.bottleneck.symbol, "mUSDC");
});

test("buildReport: one token drained → EMPTY overall", () => {
  const balances = [
    1_000_000n * 10n ** 6n, // 1,000,000 mUSDC (OK)
    1_000n * 10n ** 18n,    // 1,000     mWETH (OK)
    0n,                      // 0          mWBTC (EMPTY)
  ];
  const report = buildReport({
    chainId: BASE_SEPOLIA_CHAIN_ID,
    faucetAddress: DEFAULT_FAUCET_ADDRESS,
    tokens: DEFAULT_TOKENS,
    balances,
    threshold: DEFAULT_THRESHOLD_CLAIMS,
  });
  assert.equal(report.overallStatus, STATUS_EMPTY);
  assert.equal(report.exitCode, EXIT_EMPTY);
  assert.equal(report.bottleneck.symbol, "mWBTC");
  assert.equal(report.bottleneck.claimsLeft, 0n);
  assert.equal(report.rows[2].status, STATUS_EMPTY);
  assert.equal(report.rows[0].status, STATUS_OK);
});

test("buildReport: one token below threshold → LOW overall (no EMPTY)", () => {
  // 50 mUSDC claims left (below 100 threshold), others healthy.
  const balances = [
    50n * 1_000n * 10n ** 6n, // 50,000 mUSDC = 50 claims
    1_000n * 10n ** 18n,
    500n * 10n ** 8n,
  ];
  const report = buildReport({
    chainId: BASE_SEPOLIA_CHAIN_ID,
    faucetAddress: DEFAULT_FAUCET_ADDRESS,
    tokens: DEFAULT_TOKENS,
    balances,
    threshold: DEFAULT_THRESHOLD_CLAIMS,
  });
  assert.equal(report.overallStatus, STATUS_LOW);
  assert.equal(report.exitCode, EXIT_LOW);
  assert.equal(report.bottleneck.symbol, "mUSDC");
  assert.equal(report.bottleneck.claimsLeft, 50n);
  assert.equal(report.rows[0].status, STATUS_LOW);
});

// ---------------------------------------------------------------------------
// formatReportHuman + reportToJson — stability of output shape
// ---------------------------------------------------------------------------

test("formatReportHuman: includes faucet address, chain, threshold, and overall", () => {
  const report = buildReport({
    chainId: BASE_SEPOLIA_CHAIN_ID,
    faucetAddress: DEFAULT_FAUCET_ADDRESS,
    tokens: DEFAULT_TOKENS,
    balances: [1_000_000n * 10n ** 6n, 1_000n * 10n ** 18n, 500n * 10n ** 8n],
    threshold: DEFAULT_THRESHOLD_CLAIMS,
  });
  const text = formatReportHuman(report);
  assert.match(text, /Base Sepolia 84532/);
  assert.match(text, new RegExp(DEFAULT_FAUCET_ADDRESS));
  assert.match(text, /Threshold: 100 claims/);
  assert.match(text, /Bottleneck: mUSDC, 1000 claims left/);
  assert.match(text, /Overall:\s+OK/);
});

test("reportToJson: bigints are stringified; structure is parseable", () => {
  const report = buildReport({
    chainId: BASE_SEPOLIA_CHAIN_ID,
    faucetAddress: DEFAULT_FAUCET_ADDRESS,
    tokens: DEFAULT_TOKENS,
    balances: [0n, 1_000n * 10n ** 18n, 500n * 10n ** 8n],
    threshold: DEFAULT_THRESHOLD_CLAIMS,
  });
  const j = reportToJson(report);
  const round = JSON.parse(JSON.stringify(j));
  assert.equal(round.chainId, 84532);
  assert.equal(round.faucetAddress, DEFAULT_FAUCET_ADDRESS);
  assert.equal(round.threshold, "100");
  assert.equal(round.overallStatus, STATUS_EMPTY);
  assert.equal(round.exitCode, EXIT_EMPTY);
  assert.equal(round.bottleneck.symbol, "mUSDC");
  assert.equal(round.bottleneck.claimsLeft, "0");
  assert.equal(round.rows.length, 3);
  assert.equal(round.rows[0].symbol, "mUSDC");
  assert.equal(round.rows[0].balance, "0");
  assert.equal(round.rows[0].claimsLeft, "0");
  assert.equal(round.rows[0].status, STATUS_EMPTY);
});
