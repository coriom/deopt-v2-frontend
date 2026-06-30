// TESTNET-FAUCET-RESERVE-MONITOR-V1 — pure logic for the testnet
// faucet reserve monitor.
//
// Kept side-effect-free (no I/O, no viem imports) so the unit tests
// under `tests/node/` can exercise every branch without hitting an
// RPC. The CLI entry point `check-testnet-faucet-reserves.mjs`
// composes these helpers with a viem `publicClient`.

export const STATUS_OK = "OK";
export const STATUS_LOW = "LOW";
export const STATUS_EMPTY = "EMPTY";

export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_LOW = 2;
export const EXIT_EMPTY = 3;

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_MAINNET_CHAIN_ID = 8453;

// Documented live faucet + tokens — match
// `~/DEOPT/docs/TESTNET_FAUCET_BROADCAST_AND_ACTIVATION_V1_RESULT.md`.
// Addresses are written lowercase here because viem's `readContract`
// rejects mixed-case 0x strings whose EIP-55 checksum doesn't match.
// The docs use the human-readable checksummed form; both are the
// same on-chain account.
export const DEFAULT_FAUCET_ADDRESS = "0xdf8969230142fbafbae7e4d5af3541db97526c4f";
export const DEFAULT_TOKENS = Object.freeze([
  {
    symbol: "mUSDC",
    address: "0x6eae407f5640b006fac9965182e238582a3b412e",
    decimals: 6,
    perClaim: 1_000n * 10n ** 6n, // 1,000 mUSDC
  },
  {
    symbol: "mWETH",
    address: "0x4deebc5f537f3b8ba0e3393807b4d699d72bdd02",
    decimals: 18,
    perClaim: 1n * 10n ** 18n, // 1 mWETH
  },
  {
    symbol: "mWBTC",
    address: "0x9d871ac7595e8da271e866608e5145252047967c",
    decimals: 8,
    perClaim: 5n * 10n ** 7n, // 0.5 mWBTC
  },
]);

export const DEFAULT_THRESHOLD_CLAIMS = 100n;

/**
 * Format a raw token amount (uint256-as-bigint) into a human string
 * using its decimals. Always shows up to `displayDecimals` digits
 * after the point (default 4) and trims trailing zeros. Thousand
 * separators on the integer part for readability.
 */
export function formatTokenAmount(raw, decimals, displayDecimals = 4) {
  if (typeof raw !== "bigint") {
    throw new TypeError("formatTokenAmount: raw must be bigint");
  }
  if (raw < 0n) throw new RangeError("formatTokenAmount: raw must be >= 0");
  const base = 10n ** BigInt(decimals);
  const intPart = raw / base;
  const fracPart = raw % base;
  const intStr = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (fracPart === 0n || displayDecimals === 0) return intStr;
  const fracFull = fracPart.toString().padStart(decimals, "0");
  const fracTrimmed = fracFull.slice(0, displayDecimals).replace(/0+$/, "");
  return fracTrimmed.length > 0 ? `${intStr}.${fracTrimmed}` : intStr;
}

/**
 * Floor-division: how many full claims the reserve covers.
 * Returns a bigint. `perClaim` must be > 0.
 */
export function computeRemainingClaims(balance, perClaim) {
  if (typeof balance !== "bigint" || typeof perClaim !== "bigint") {
    throw new TypeError("computeRemainingClaims: balance + perClaim must be bigint");
  }
  if (perClaim <= 0n) throw new RangeError("computeRemainingClaims: perClaim must be > 0");
  if (balance < 0n) throw new RangeError("computeRemainingClaims: balance must be >= 0");
  return balance / perClaim;
}

/**
 * Classify a single token's status. EMPTY beats LOW beats OK.
 * `threshold` is in claims (bigint).
 */
export function classifyStatus(claimsLeft, threshold) {
  if (typeof claimsLeft !== "bigint" || typeof threshold !== "bigint") {
    throw new TypeError("classifyStatus: both args must be bigint");
  }
  if (threshold < 0n) throw new RangeError("classifyStatus: threshold must be >= 0");
  if (claimsLeft <= 0n) return STATUS_EMPTY;
  if (claimsLeft < threshold) return STATUS_LOW;
  return STATUS_OK;
}

/**
 * Aggregate per-token statuses into a single overall status using
 * the worst-case rule (EMPTY > LOW > OK).
 */
export function aggregateStatus(statuses) {
  if (!Array.isArray(statuses) || statuses.length === 0) return STATUS_EMPTY;
  if (statuses.includes(STATUS_EMPTY)) return STATUS_EMPTY;
  if (statuses.includes(STATUS_LOW)) return STATUS_LOW;
  return STATUS_OK;
}

/**
 * Pick the bottleneck token (smallest `claimsLeft`). On ties, the
 * first-listed token wins (preserves the configured display order).
 * Returns `null` for an empty input.
 */
export function pickBottleneck(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  let best = rows[0];
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].claimsLeft < best.claimsLeft) best = rows[i];
  }
  return best;
}

/**
 * Map exit code from overall status.
 *   OK    -> 0
 *   LOW   -> 2
 *   EMPTY -> 3
 * (Errors during execution use EXIT_ERROR=1, handled at the CLI
 * layer rather than here.)
 */
export function exitCodeForStatus(status) {
  switch (status) {
    case STATUS_OK: return EXIT_OK;
    case STATUS_LOW: return EXIT_LOW;
    case STATUS_EMPTY: return EXIT_EMPTY;
    default: return EXIT_ERROR;
  }
}

/**
 * Build the printable + JSON report from raw inputs. Pure function:
 * given the same inputs, returns the same structure. The CLI only
 * has to render this.
 */
export function buildReport({ chainId, faucetAddress, tokens, balances, threshold }) {
  if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
    throw new RangeError(
      `buildReport: refusing chain id ${chainId}; expected ${BASE_SEPOLIA_CHAIN_ID} (Base Sepolia)`,
    );
  }
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new RangeError("buildReport: tokens must be a non-empty array");
  }
  if (!Array.isArray(balances) || balances.length !== tokens.length) {
    throw new RangeError("buildReport: balances must match tokens length");
  }
  const rows = tokens.map((tok, i) => {
    const balance = balances[i];
    const claimsLeft = computeRemainingClaims(balance, tok.perClaim);
    const status = classifyStatus(claimsLeft, threshold);
    return {
      symbol: tok.symbol,
      address: tok.address,
      decimals: tok.decimals,
      perClaimRaw: tok.perClaim,
      perClaimHuman: formatTokenAmount(tok.perClaim, tok.decimals),
      balanceRaw: balance,
      balanceHuman: formatTokenAmount(balance, tok.decimals),
      claimsLeft,
      status,
    };
  });
  const bottleneck = pickBottleneck(rows);
  const overallStatus = aggregateStatus(rows.map((r) => r.status));
  return {
    chainId,
    faucetAddress,
    threshold,
    rows,
    bottleneck,
    overallStatus,
    exitCode: exitCodeForStatus(overallStatus),
  };
}

/**
 * Human-readable report renderer. Stable output; safe to embed in
 * tests via `toContain` / `toMatch` checks.
 */
export function formatReportHuman(report) {
  const lines = [];
  lines.push("DeOpt Testnet Faucet Reserve Monitor");
  lines.push(`Chain:     Base Sepolia ${report.chainId}`);
  lines.push(`Faucet:    ${report.faucetAddress}`);
  lines.push(`Threshold: ${report.threshold.toString()} claims`);
  lines.push("");
  // Fixed-width columns (right-padded). Plain ASCII so terminals
  // without unicode glyphs render cleanly.
  const header = padCells(["Token", "Balance", "Per claim", "Claims left", "Status"]);
  lines.push(header);
  lines.push("-".repeat(header.length));
  for (const r of report.rows) {
    lines.push(
      padCells([
        r.symbol,
        r.balanceHuman,
        r.perClaimHuman,
        r.claimsLeft.toString(),
        r.status,
      ]),
    );
  }
  lines.push("");
  if (report.bottleneck) {
    lines.push(
      `Bottleneck: ${report.bottleneck.symbol}, ${report.bottleneck.claimsLeft.toString()} claims left`,
    );
  } else {
    lines.push("Bottleneck: (no tokens configured)");
  }
  lines.push(`Overall:    ${report.overallStatus}`);
  return lines.join("\n");
}

/**
 * JSON-safe view (bigints → strings). Stable shape for piping into
 * scripts / log indexers.
 */
export function reportToJson(report) {
  return {
    chainId: report.chainId,
    faucetAddress: report.faucetAddress,
    threshold: report.threshold.toString(),
    overallStatus: report.overallStatus,
    exitCode: report.exitCode,
    bottleneck: report.bottleneck
      ? {
          symbol: report.bottleneck.symbol,
          claimsLeft: report.bottleneck.claimsLeft.toString(),
        }
      : null,
    rows: report.rows.map((r) => ({
      symbol: r.symbol,
      address: r.address,
      decimals: r.decimals,
      perClaim: r.perClaimRaw.toString(),
      perClaimHuman: r.perClaimHuman,
      balance: r.balanceRaw.toString(),
      balanceHuman: r.balanceHuman,
      claimsLeft: r.claimsLeft.toString(),
      status: r.status,
    })),
  };
}

const CELL_WIDTHS = [8, 16, 12, 14, 8];
function padCells(cells) {
  return cells
    .map((c, i) => String(c).padEnd(CELL_WIDTHS[i] ?? 12, " "))
    .join("");
}
