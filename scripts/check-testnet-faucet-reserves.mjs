#!/usr/bin/env node
// TESTNET-FAUCET-RESERVE-MONITOR-V1 — CLI.
//
// Read-only Base Sepolia faucet reserve monitor. Reads on-chain
// balances of mUSDC / mWETH / mWBTC at the deployed `TestnetFaucet`
// and reports how many claims remain before testers hit
// `InsufficientReserves`.
//
// **Safety:**
//   * No transaction, no broadcast, no signer required.
//   * Aborts immediately if the RPC reports any chain id other than
//     84532 (Base Sepolia). Base mainnet 8453 specifically refused.
//   * Never prints secret env values; documents env names only.
//
// **Usage:**
//
//   # Defaults: live faucet address + 3 documented tokens,
//   # public Base Sepolia RPC, threshold = 100 claims, human output.
//   npm run testnet:faucet:reserves
//
//   # JSON mode (for piping into log indexers):
//   npm run testnet:faucet:reserves -- --json
//
//   # Override threshold + faucet address via env:
//   TESTNET_FAUCET_ADDRESS=0x... \
//   TESTNET_FAUCET_MIN_CLAIMS=200 \
//   RPC_URL=https://your-base-sepolia-rpc \
//   npm run testnet:faucet:reserves
//
// **Exit codes:**
//   0 = all tokens OK
//   1 = execution / config error
//   2 = at least one token below threshold (LOW)
//   3 = at least one token at zero (EMPTY)

import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

import {
  BASE_SEPOLIA_CHAIN_ID,
  DEFAULT_FAUCET_ADDRESS,
  DEFAULT_TOKENS,
  DEFAULT_THRESHOLD_CLAIMS,
  EXIT_ERROR,
  buildReport,
  formatReportHuman,
  reportToJson,
} from "./faucet-reserve-monitor.lib.mjs";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ERC20_BALANCE_OF_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
];

function fail(message) {
  // stderr → operator sees the diagnosis; stdout stays clean for
  // JSON consumers if `--json` was supplied.
  process.stderr.write(`error: ${message}\n`);
  process.exit(EXIT_ERROR);
}

function readEnvAddress(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  if (!ADDRESS_RE.test(raw)) {
    fail(`env ${name} must be a 0x-hex address (40 hex chars); got malformed value (not printed).`);
  }
  return raw;
}

function readEnvThreshold() {
  const raw = process.env.TESTNET_FAUCET_MIN_CLAIMS;
  if (raw === undefined || raw === "") return DEFAULT_THRESHOLD_CLAIMS;
  if (!/^\d+$/.test(raw)) {
    fail(`env TESTNET_FAUCET_MIN_CLAIMS must be a non-negative integer; got malformed value (not printed).`);
  }
  return BigInt(raw);
}

function parseArgs(argv) {
  const args = { json: false };
  for (const a of argv.slice(2)) {
    if (a === "--json") args.json = true;
    else if (a === "--help" || a === "-h") {
      process.stdout.write(
        [
          "Usage: check-testnet-faucet-reserves.mjs [--json]",
          "",
          "Env:",
          "  RPC_URL                              (default: https://sepolia.base.org)",
          "  TESTNET_FAUCET_ADDRESS               (default: live faucet address)",
          "  TESTNET_FAUCET_MUSDC_ADDRESS         (default: documented mUSDC)",
          "  TESTNET_FAUCET_MWETH_ADDRESS         (default: documented mWETH)",
          "  TESTNET_FAUCET_MWBTC_ADDRESS         (default: documented mWBTC)",
          "  TESTNET_FAUCET_MIN_CLAIMS            (default: 100)",
          "",
          "Exit: 0=OK 1=ERROR 2=LOW 3=EMPTY",
          "",
        ].join("\n"),
      );
      process.exit(0);
    } else {
      fail(`unknown argument: ${a}`);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  const faucetAddress = readEnvAddress("TESTNET_FAUCET_ADDRESS", DEFAULT_FAUCET_ADDRESS);
  const threshold = readEnvThreshold();
  const tokens = DEFAULT_TOKENS.map((tok) => {
    const envName = `TESTNET_FAUCET_${tok.symbol.toUpperCase()}_ADDRESS`;
    return { ...tok, address: readEnvAddress(envName, tok.address) };
  });

  // RPC URL: never echoed. Default is the public Base Sepolia RPC
  // which has no authentication and is safe to default to. Operator
  // can override via env if they prefer their own.
  const rpcUrl = process.env.RPC_URL && process.env.RPC_URL !== ""
    ? process.env.RPC_URL
    : "https://sepolia.base.org";

  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  let chainId;
  try {
    chainId = await client.getChainId();
  } catch (err) {
    fail(`RPC unreachable (chain id call failed): ${stripSecrets(err)}`);
  }
  if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
    fail(`refusing chain id ${chainId}; expected ${BASE_SEPOLIA_CHAIN_ID} (Base Sepolia). No mainnet, no other chains.`);
  }

  // viem's `readContract` rejects mixed-case 0x strings whose
  // EIP-55 checksum doesn't match. Lowercase is always accepted and
  // is the same on-chain account either way — normalize defensively.
  const balances = [];
  for (const tok of tokens) {
    try {
      const balance = await client.readContract({
        address: tok.address.toLowerCase(),
        abi: ERC20_BALANCE_OF_ABI,
        functionName: "balanceOf",
        args: [faucetAddress.toLowerCase()],
      });
      balances.push(balance);
    } catch (err) {
      fail(`balanceOf(${tok.symbol}) failed: ${stripSecrets(err)}`);
    }
  }

  const report = buildReport({ chainId, faucetAddress, tokens, balances, threshold });

  if (args.json) {
    process.stdout.write(`${JSON.stringify(reportToJson(report), null, 2)}\n`);
  } else {
    process.stdout.write(`${formatReportHuman(report)}\n`);
  }
  process.exit(report.exitCode);
}

// Defensive: viem errors sometimes include the request URL (which
// may contain an API key). Mask `http(s)://...` URLs before printing.
function stripSecrets(err) {
  const raw = (err && err.shortMessage) || (err && err.message) || String(err);
  return raw.replace(/https?:\/\/\S+/g, "<redacted-url>");
}

main().catch((err) => {
  fail(`unhandled error: ${stripSecrets(err)}`);
});
