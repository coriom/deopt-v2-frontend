#!/usr/bin/env node
// TESTNET-AUTOMATED-SOLO-USER-JOURNEY-REHEARSAL-V1 — burner wallet
// generator.
//
// Generates 3 fresh Base Sepolia testnet burner wallets (A, B, C)
// and writes them to a single untracked JSON file under
// `~/DEOPT/.local/testnet-rehearsal-wallets.json` (gitignored at
// the workspace root).
//
// **Safety:** prints PUBLIC addresses only. Private keys are
// written to disk under permissions 0600 and never echoed. If the
// target file already exists, the script refuses to overwrite —
// run with `--force` to regenerate (which will destroy any unrecov-
// erable balance left on the existing addresses).

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { mkdirSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { homedir } from "node:os";

const TARGET = `${homedir()}/DEOPT/.local/testnet-rehearsal-wallets.json`;
const FORCE = process.argv.includes("--force");
const LABELS = ["A", "B", "C"];

if (existsSync(TARGET) && !FORCE) {
  process.stderr.write(
    `error: ${TARGET} already exists. Pass --force to overwrite (existing balances will be unrecoverable).\n`,
  );
  process.exit(1);
}

mkdirSync(dirname(TARGET), { recursive: true });

const wallets = {};
const publicAddresses = [];
for (const label of LABELS) {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  wallets[label] = {
    privateKey, // 0x-prefixed 32-byte hex; NEVER printed to stdout
    address: account.address,
    createdAt: new Date().toISOString(),
    purpose: {
      A: "primary taker/maker — claims faucet + submits orders + cancels",
      B: "counterparty — claims faucet + crosses A's orders for fills",
      C: "edge cases — cooldown / disconnected / wrong-network / no-claim states",
    }[label],
  };
  publicAddresses.push({ label, address: account.address });
}

const blob = {
  milestone: "TESTNET-AUTOMATED-SOLO-USER-JOURNEY-REHEARSAL-V1",
  chain: "Base Sepolia",
  chainId: 84532,
  generatedAt: new Date().toISOString(),
  wallets,
  warnings: [
    "TESTNET BURNER KEYS ONLY — never load these into a real wallet.",
    "Never send mainnet ETH or any real-value asset to these addresses.",
    "This file is gitignored via ~/DEOPT/.gitignore (.local/).",
  ],
};

writeFileSync(TARGET, JSON.stringify(blob, null, 2));
chmodSync(TARGET, 0o600);

// stdout: public addresses + funding instructions ONLY.
process.stdout.write(
  [
    "TESTNET REHEARSAL BURNER WALLETS GENERATED",
    `Stored: ${TARGET} (perms 0600; gitignored)`,
    "",
    "Public addresses (safe to print):",
    ...publicAddresses.map(({ label, address }) => `  Wallet ${label}: ${address}`),
    "",
    "Operator: please fund each address with ~0.005 Base Sepolia ETH from any public",
    "faucet (Alchemy / QuickNode / Coinbase). That covers the faucet claim tx + a few",
    "follow-up txs with plenty of headroom.",
    "",
    "Then reply exactly:",
    "  FUNDED BASE SEPOLIA REHEARSAL WALLETS",
    "",
    "Wallet C is OPTIONAL — fund only if you want edge-case coverage; the rehearsal",
    "still works with A + B alone.",
  ].join("\n") + "\n",
);
