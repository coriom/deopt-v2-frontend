// Bug-report context helper.
//
// Builds a redaction-safe context string a tester can include in a bug
// report. Only PUBLIC values are collected:
//   - chain id reported by the wallet
//   - route the user was on
//   - timestamp (ISO)
//   - tx hash (if one was already broadcast and observable)
//   - intent id (UUID — backend-issued)
//   - wallet PUBLIC address (never the private key)
//
// EXPLICITLY NEVER COLLECTED:
//   - private keys
//   - seed phrases
//   - RPC URLs (which may embed an API key)
//   - admin bearer tokens
//   - backend `.env` contents
//   - DATABASE_URLs
//
// Anything an attacker could weaponise from a leaked field is excluded
// by construction. The bug-context object is shaped so it can be
// stringified into a copy-paste block inside the public bug report
// template (see `docs/public-beta/BUG_REPORT_TEMPLATE.md`).

export interface BugReportContext {
  route: string;
  chain_id: number | null;
  wallet_public_address: string | null;
  tx_hash: string | null;
  intent_id: string | null;
  timestamp_iso: string;
  app_version: string;
}

export interface BuildBugContextArgs {
  /** App route the user was on. */
  route: string;
  /** Wallet chain id; null if the wallet is not connected. */
  chainId: number | null;
  /** Wallet PUBLIC address; null if the wallet is not connected. */
  address: string | null;
  /** Tx hash if one is associated with this bug context; else null. */
  txHash?: string | null;
  /** Intent id if applicable; else null. */
  intentId?: string | null;
  /** App version label (operator may inject via env or leave constant). */
  appVersion?: string;
}

export function buildBugContext(args: BuildBugContextArgs): BugReportContext {
  return {
    route: args.route,
    chain_id: args.chainId,
    wallet_public_address: args.address,
    tx_hash: args.txHash ?? null,
    intent_id: args.intentId ?? null,
    timestamp_iso: new Date().toISOString(),
    app_version: args.appVersion ?? "deopt-v2-frontend@0.1.0",
  };
}

/**
 * Format the context as a copy-paste-safe block. Intentionally omits
 * any field whose value is null so the tester doesn't paste empty rows.
 */
export function formatBugContextForCopy(ctx: BugReportContext): string {
  const rows: string[] = [];
  rows.push(`route: ${ctx.route}`);
  rows.push(`chain_id: ${ctx.chain_id ?? "(not connected)"}`);
  if (ctx.wallet_public_address) {
    rows.push(`wallet_public_address: ${ctx.wallet_public_address}`);
  }
  if (ctx.tx_hash) {
    rows.push(`tx_hash: ${ctx.tx_hash}`);
  }
  if (ctx.intent_id) {
    rows.push(`intent_id: ${ctx.intent_id}`);
  }
  rows.push(`timestamp_iso: ${ctx.timestamp_iso}`);
  rows.push(`app_version: ${ctx.app_version}`);
  rows.push("");
  rows.push("# NEVER share private keys, seed phrases, RPC URLs with");
  rows.push("# embedded API keys, admin bearer tokens, or .env contents.");
  return rows.join("\n");
}
