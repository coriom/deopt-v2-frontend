#!/usr/bin/env node
// TESTNET-AUTOMATED-SOLO-USER-JOURNEY-REHEARSAL-V1 — Phase 2.5c.
//
// Polls Wallet A's Base Sepolia balance until it crosses a target
// threshold, then exits 0. Used after `rehearsal-bridge-a-eth-to-base.mjs`
// to wait for the L1→L2 deposit to land. Read-only; no signer.

import {
  assertChainBaseSepolia,
  formatEth,
  loadBurnerWallets,
  makePublicClient,
  stripSecrets,
} from "./rehearsal-lib.mjs";

const EXPECTED_A = "0x2e578264927E1be9C9B00A7Ed580bF01b634Cd19".toLowerCase();
const MIN_TARGET_WEI = 15_000_000_000_000_000n; // 0.015 ETH headroom
const POLL_INTERVAL_MS = 15_000;
const MAX_POLLS = 40; // ~10 min total

function fail(msg) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

async function main() {
  const wallets = loadBurnerWallets();
  if (!wallets.A) fail("Wallet A missing from burner wallet file");
  if (wallets.A.address.toLowerCase() !== EXPECTED_A) {
    fail(`Wallet A address mismatch: ${wallets.A.address} vs ${EXPECTED_A}`);
  }

  const publicClient = makePublicClient();
  try {
    await assertChainBaseSepolia(publicClient);
  } catch (err) {
    fail(`chain check failed: ${stripSecrets(err)}`);
  }

  process.stdout.write(
    `Polling Base Sepolia for Wallet A balance >= ${formatEth(MIN_TARGET_WEI)} ETH (max ${MAX_POLLS} polls × ${POLL_INTERVAL_MS / 1000}s)...\n`,
  );

  for (let i = 0; i < MAX_POLLS; i += 1) {
    const bal = await publicClient.getBalance({ address: wallets.A.address });
    process.stdout.write(`poll ${i + 1}/${MAX_POLLS}: Wallet A = ${formatEth(bal)} ETH\n`);
    if (bal >= MIN_TARGET_WEI) {
      process.stdout.write(`\nL2 deposit confirmed. Wallet A on Base Sepolia: ${formatEth(bal)} ETH\n`);
      process.exit(0);
    }
    if (i < MAX_POLLS - 1) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
  fail(`timed out after ${MAX_POLLS * POLL_INTERVAL_MS / 1000}s without seeing target balance on L2`);
}

main().catch((err) => fail(`unhandled: ${stripSecrets(err)}`));
