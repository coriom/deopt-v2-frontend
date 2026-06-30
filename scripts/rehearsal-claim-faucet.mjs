#!/usr/bin/env node
// TESTNET-AUTOMATED-SOLO-USER-JOURNEY-REHEARSAL-V1 — Phase 4.
//
// Calls `TestnetFaucet.claim()` on Base Sepolia from a generated
// burner wallet (`A`, `B`, or `C`). Captures the tx hash, waits
// for confirmation, then reads back balances and the post-claim
// `nextClaimAvailableAt(caller)` to verify the cooldown was set.
//
// Usage:
//   node scripts/rehearsal-claim-faucet.mjs <A|B|C>
//
// Safety: chain id MUST be 84532; refuses anything else. Never
// prints private keys. Faucet/token addresses are loaded from
// `rehearsal-lib.mjs` (lowercased to satisfy viem's EIP-55 check).

import {
  ERC20_BALANCE_OF_ABI,
  FAUCET_ADDRESS,
  FAUCET_CLAIM_ABI,
  FAUCET_READ_ABI,
  TOKEN_ADDRESSES,
  assertChainBaseSepolia,
  formatEth,
  loadBurnerWallets,
  makePublicClient,
  makeWalletClient,
  stripSecrets,
} from "./rehearsal-lib.mjs";

function fail(msg) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

function formatToken(raw, decimals) {
  const base = 10n ** BigInt(decimals);
  const intPart = raw / base;
  const fracPart = raw % base;
  const intStr = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (fracPart === 0n) return intStr;
  const fracStr = fracPart.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${intStr}.${fracStr}`;
}

async function main() {
  const label = process.argv[2];
  if (!label || !["A", "B", "C"].includes(label)) {
    fail("usage: node scripts/rehearsal-claim-faucet.mjs <A|B|C>");
  }

  const wallets = loadBurnerWallets();
  if (!wallets[label]) fail(`Wallet ${label} missing from burner wallet file`);

  const publicClient = makePublicClient();
  try {
    await assertChainBaseSepolia(publicClient);
  } catch (err) {
    fail(`chain check failed: ${stripSecrets(err)}`);
  }

  const walletClient = makeWalletClient(wallets[label].account);
  const caller = wallets[label].address;
  process.stdout.write(
    [
      `Phase 4 — Wallet ${label} claim()`,
      `Caller:            ${caller}`,
      `Faucet:            ${FAUCET_ADDRESS}`,
      "",
    ].join("\n"),
  );

  // Read pre-state.
  const [paused, cooldown, nextAt, ethBal] = await Promise.all([
    publicClient.readContract({ address: FAUCET_ADDRESS, abi: FAUCET_READ_ABI, functionName: "paused" }),
    publicClient.readContract({ address: FAUCET_ADDRESS, abi: FAUCET_READ_ABI, functionName: "cooldownSeconds" }),
    publicClient.readContract({ address: FAUCET_ADDRESS, abi: FAUCET_READ_ABI, functionName: "nextClaimAvailableAt", args: [caller] }),
    publicClient.getBalance({ address: caller }),
  ]);
  process.stdout.write(
    [
      `paused:                  ${paused}`,
      `cooldownSeconds:         ${cooldown.toString()}`,
      `nextClaimAvailableAt:    ${nextAt.toString()} (0 = never claimed)`,
      `caller ETH balance:      ${formatEth(ethBal)} ETH`,
      "",
    ].join("\n"),
  );

  if (paused) fail("faucet is paused — cannot claim");

  const preBalances = {};
  for (const [symbol, { address, decimals }] of Object.entries(TOKEN_ADDRESSES)) {
    preBalances[symbol] = await publicClient.readContract({
      address,
      abi: ERC20_BALANCE_OF_ABI,
      functionName: "balanceOf",
      args: [caller],
    });
    process.stdout.write(`pre  ${symbol}: ${formatToken(preBalances[symbol], decimals)}\n`);
  }
  process.stdout.write("\n");

  // Static-call first (this would catch CooldownNotElapsed before
  // we burn gas).
  try {
    await publicClient.simulateContract({
      account: caller,
      address: FAUCET_ADDRESS,
      abi: FAUCET_CLAIM_ABI,
      functionName: "claim",
    });
  } catch (err) {
    fail(`simulate claim() reverted: ${stripSecrets(err)}`);
  }
  process.stdout.write("simulation clean — broadcasting claim()...\n");

  const txHash = await walletClient.writeContract({
    address: FAUCET_ADDRESS,
    abi: FAUCET_CLAIM_ABI,
    functionName: "claim",
  });
  process.stdout.write(`tx hash: ${txHash}\nwaiting...\n`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  process.stdout.write(`status: ${receipt.status}\nblock: ${receipt.blockNumber.toString()}\ngas used: ${receipt.gasUsed.toString()}\n\n`);

  if (receipt.status !== "success") fail(`claim() reverted; tx ${receipt.transactionHash}`);

  // Post-state. Public Base Sepolia RPC sometimes lags by a few
  // seconds between tx receipt and balance read; retry with a
  // short backoff so the operator sees the verified delta.
  async function readBalanceWithRetry(address) {
    for (let i = 0; i < 8; i += 1) {
      const bal = await publicClient.readContract({
        address,
        abi: ERC20_BALANCE_OF_ABI,
        functionName: "balanceOf",
        args: [caller],
      });
      if (bal > 0n) return bal;
      await new Promise((r) => setTimeout(r, 3_000));
    }
    return 0n;
  }

  const postNextAt = await publicClient.readContract({
    address: FAUCET_ADDRESS,
    abi: FAUCET_READ_ABI,
    functionName: "nextClaimAvailableAt",
    args: [caller],
  });
  process.stdout.write(`post nextClaimAvailableAt: ${postNextAt.toString()}\n`);

  let ok = true;
  for (const [symbol, { address, decimals }] of Object.entries(TOKEN_ADDRESSES)) {
    const post = await readBalanceWithRetry(address);
    const delta = post - preBalances[symbol];
    process.stdout.write(
      `post ${symbol}: ${formatToken(post, decimals)} (delta +${formatToken(delta, decimals)})\n`,
    );
    if (delta === 0n) ok = false;
  }
  if (!ok) fail("at least one token delta was 0 — claim() did not transfer expected amounts (RPC may be lagging; cross-check via a different RPC)");
  process.stdout.write("\nclaim verified.\n");
}

main().catch((err) => fail(`unhandled: ${stripSecrets(err)}`));
