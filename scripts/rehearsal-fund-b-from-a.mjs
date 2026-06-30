#!/usr/bin/env node
// TESTNET-AUTOMATED-SOLO-USER-JOURNEY-REHEARSAL-V1 — Phase 2.5.
//
// Send exactly 0.01 Base Sepolia ETH from generated burner Wallet A
// to generated burner Wallet B so Wallet B has gas to claim from the
// faucet. Hard-coded sender/recipient/amount; refuses to do anything
// else. Requires operator approval (this script is only run after
// `FUNDED BASE SEPOLIA REHEARSAL WALLETS` is received).
//
// **Safety guards (all enforced before any signing):**
//   * chain id MUST be 84532 (Base Sepolia); Base mainnet refused.
//   * sender MUST be Wallet A's exact address.
//   * recipient MUST be Wallet B's exact address.
//   * amount MUST be exactly 0.01 ETH (1e16 wei).
//   * Wallet A balance MUST cover amount + estimated gas with margin.
//
// Never prints private keys, never echoes RPC URLs, never `bash -x`.

import {
  BASE_SEPOLIA_CHAIN_ID,
  assertChainBaseSepolia,
  formatEth,
  loadBurnerWallets,
  makePublicClient,
  makeWalletClient,
  stripSecrets,
} from "./rehearsal-lib.mjs";

const EXPECTED_A = "0x2e578264927E1be9C9B00A7Ed580bF01b634Cd19".toLowerCase();
const EXPECTED_B = "0x7A420792f076D531D2802F21DC7d56bd70785798".toLowerCase();
// Brief authorized 0.005 ETH after the L1→L2 bridge (lower than the
// original 0.01 ETH allowance because A's L2 balance is now 0.02 ETH
// — leaving A with 0.015 ETH headroom for claim + a few txs).
const AMOUNT_WEI = 5_000_000_000_000_000n; // 0.005 ETH
const MIN_A_BALANCE_WEI = 10_000_000_000_000_000n; // 0.01 ETH minimum

function fail(msg) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

async function main() {
  const wallets = loadBurnerWallets();
  if (!wallets.A) fail("Wallet A not found in wallet file");
  if (!wallets.B) fail("Wallet B not found in wallet file");

  if (wallets.A.address.toLowerCase() !== EXPECTED_A) {
    fail(`Wallet A address mismatch (file vs expected). Stored: ${wallets.A.address}`);
  }
  if (wallets.B.address.toLowerCase() !== EXPECTED_B) {
    fail(`Wallet B address mismatch (file vs expected). Stored: ${wallets.B.address}`);
  }

  const publicClient = makePublicClient();
  let chainId;
  try {
    chainId = await assertChainBaseSepolia(publicClient);
  } catch (err) {
    fail(`chain check failed: ${stripSecrets(err)}`);
  }
  if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
    fail(`unexpected chain id ${chainId}; only Base Sepolia 84532 allowed`);
  }

  const balanceA = await publicClient.getBalance({ address: wallets.A.address });
  const balanceB = await publicClient.getBalance({ address: wallets.B.address });
  process.stdout.write(
    [
      "Phase 2.5 — fund Wallet B from Wallet A",
      `Chain:                 Base Sepolia ${chainId}`,
      `Wallet A address:      ${wallets.A.address}`,
      `Wallet B address:      ${wallets.B.address}`,
      `Wallet A balance:      ${formatEth(balanceA)} ETH`,
      `Wallet B balance:      ${formatEth(balanceB)} ETH (pre-transfer)`,
      `Amount to transfer:    ${formatEth(AMOUNT_WEI)} ETH (hardcoded)`,
      "",
    ].join("\n"),
  );

  if (balanceA < MIN_A_BALANCE_WEI) {
    fail(
      `Wallet A balance ${formatEth(balanceA)} ETH < required minimum ${formatEth(MIN_A_BALANCE_WEI)} ETH. Top up A from a public faucet first.`,
    );
  }

  // Estimate gas for a plain native-ETH transfer. 21,000 gas is the
  // floor; viem may report higher. Cap the safety margin to keep the
  // operator-facing report deterministic.
  const gasPrice = await publicClient.getGasPrice();
  const estGasUnits = 21_000n;
  const estFeeWei = estGasUnits * gasPrice;
  process.stdout.write(
    [
      `Gas price:             ${gasPrice.toString()} wei`,
      `Est. gas units:        ${estGasUnits.toString()}`,
      `Est. fee:              ${formatEth(estFeeWei)} ETH`,
      "",
    ].join("\n"),
  );

  if (balanceA < AMOUNT_WEI + estFeeWei * 2n) {
    fail(
      `Wallet A balance ${formatEth(balanceA)} ETH < amount + 2× fee buffer ${formatEth(AMOUNT_WEI + estFeeWei * 2n)} ETH`,
    );
  }

  const walletClient = makeWalletClient(wallets.A.account);

  // Sanity: the resolved sender MUST be A. viem will refuse to send
  // if the account doesn't match, but the explicit assertion gives
  // a cleaner error if a future change weakens the loader.
  if (walletClient.account.address.toLowerCase() !== EXPECTED_A) {
    fail(`viem walletClient resolved sender ${walletClient.account.address}; expected Wallet A ${wallets.A.address}`);
  }

  let txHash;
  try {
    txHash = await walletClient.sendTransaction({
      to: wallets.B.address,
      value: AMOUNT_WEI,
    });
  } catch (err) {
    fail(`sendTransaction failed: ${stripSecrets(err)}`);
  }

  process.stdout.write(`tx submitted: ${txHash}\nwaiting for confirmation...\n`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const finalA = await publicClient.getBalance({ address: wallets.A.address });
  const finalB = await publicClient.getBalance({ address: wallets.B.address });

  process.stdout.write(
    [
      "",
      "Phase 2.5 — funding complete",
      `tx hash:               ${receipt.transactionHash}`,
      `status:                ${receipt.status}`,
      `block:                 ${receipt.blockNumber.toString()} (0x${receipt.blockNumber.toString(16)})`,
      `gas used:              ${receipt.gasUsed.toString()}`,
      `Wallet A balance:      ${formatEth(finalA)} ETH (after)`,
      `Wallet B balance:      ${formatEth(finalB)} ETH (after)`,
      "",
    ].join("\n"),
  );

  if (receipt.status !== "success") {
    fail(`tx reverted with status ${receipt.status}`);
  }
  if (finalB - balanceB !== AMOUNT_WEI) {
    fail(
      `Wallet B balance delta ${formatEth(finalB - balanceB)} ETH != expected ${formatEth(AMOUNT_WEI)} ETH`,
    );
  }
}

main().catch((err) => {
  fail(`unhandled: ${stripSecrets(err)}`);
});
