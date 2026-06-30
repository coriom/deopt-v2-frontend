#!/usr/bin/env node
// TESTNET-AUTOMATED-SOLO-USER-JOURNEY-REHEARSAL-V1 — Phase 2.5b.
//
// Bridges exactly 0.02 ETH from Wallet A on Ethereum Sepolia (L1
// chain id 11155111) to Wallet A on Base Sepolia (L2 chain id
// 84532) via the OFFICIAL Base L1StandardBridge. Operator approval
// is required (this script is only run after the explicit
// authorization granted in the milestone brief).
//
// **Bridge target (verified before sending):**
//   * Address: 0xfd0Bf71F60660E2f608ed56e1659C450eB113120
//   * Identity confirmed via:
//       MESSENGER()    = 0xC34855F4De64F1840e5686e64278da901e261f20
//                        (Base Sepolia L1CrossDomainMessenger)
//       OTHER_BRIDGE() = 0x4200000000000000000000000000000000000010
//                        (canonical OP Stack L2StandardBridge predeploy)
//   * Bytecode size: 4,946 bytes (non-empty).
//
// **Hard guards before signing:**
//   * Source chain MUST be Ethereum Sepolia 11155111. Aborts on
//     mainnet 1, Base 8453, Base Sepolia 84532, anything else.
//   * Sender MUST be Wallet A's exact public address.
//   * Amount MUST be exactly 0.02 ETH (2e16 wei).
//   * L2 recipient MUST equal Wallet A (same address bridge).
//   * Wallet A L1 balance MUST cover amount + 2× estimated gas.
//
// Never prints private keys, RPC URLs, or signed transactions.

import { createPublicClient, createWalletClient, encodeFunctionData, http } from "viem";
import { sepolia } from "viem/chains";

import {
  formatEth,
  loadBurnerWallets,
  stripSecrets,
} from "./rehearsal-lib.mjs";

const L1_BRIDGE = "0xfd0Bf71F60660E2f608ed56e1659C450eB113120";
const EXPECTED_MESSENGER = "0xc34855f4de64f1840e5686e64278da901e261f20";
const EXPECTED_OTHER_BRIDGE = "0x4200000000000000000000000000000000000010";

const ETH_SEPOLIA_CHAIN_ID = 11155111;
const FORBIDDEN_CHAIN_IDS = new Set([1, 8453, 137, 10, 56]); // mainnets

const EXPECTED_A = "0x2e578264927E1be9C9B00A7Ed580bF01b634Cd19".toLowerCase();
const AMOUNT_WEI = 20_000_000_000_000_000n; // 0.02 ETH

const BRIDGE_ETH_TO_ABI = [
  {
    type: "function",
    name: "bridgeETHTo",
    stateMutability: "payable",
    inputs: [
      { name: "_to", type: "address" },
      { name: "_minGasLimit", type: "uint32" },
      { name: "_extraData", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "MESSENGER",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "OTHER_BRIDGE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
];

function l1RpcUrl() {
  return process.env.L1_RPC_URL && process.env.L1_RPC_URL !== ""
    ? process.env.L1_RPC_URL
    : "https://ethereum-sepolia-rpc.publicnode.com";
}

function fail(msg) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

async function main() {
  const wallets = loadBurnerWallets();
  if (!wallets.A) fail("Wallet A missing from burner wallet file");
  if (wallets.A.address.toLowerCase() !== EXPECTED_A) {
    fail(`Wallet A address mismatch: file=${wallets.A.address} expected=${EXPECTED_A}`);
  }

  const publicClient = createPublicClient({ chain: sepolia, transport: http(l1RpcUrl()) });

  const chainId = await publicClient.getChainId();
  if (FORBIDDEN_CHAIN_IDS.has(chainId)) {
    fail(`refusing forbidden mainnet chain id ${chainId}`);
  }
  if (chainId !== ETH_SEPOLIA_CHAIN_ID) {
    fail(`expected Ethereum Sepolia ${ETH_SEPOLIA_CHAIN_ID}, got ${chainId}`);
  }

  // Re-verify bridge identity at sign time (defends against a
  // proxy upgrade between the offline check and broadcast).
  const [msgrAddr, otherBridge] = await Promise.all([
    publicClient.readContract({ address: L1_BRIDGE, abi: BRIDGE_ETH_TO_ABI, functionName: "MESSENGER" }),
    publicClient.readContract({ address: L1_BRIDGE, abi: BRIDGE_ETH_TO_ABI, functionName: "OTHER_BRIDGE" }),
  ]);
  if (msgrAddr.toLowerCase() !== EXPECTED_MESSENGER) {
    fail(`bridge MESSENGER() returned ${msgrAddr}; expected ${EXPECTED_MESSENGER} (Base Sepolia)`);
  }
  if (otherBridge.toLowerCase() !== EXPECTED_OTHER_BRIDGE) {
    fail(`bridge OTHER_BRIDGE() returned ${otherBridge}; expected ${EXPECTED_OTHER_BRIDGE}`);
  }

  const balanceA = await publicClient.getBalance({ address: wallets.A.address });
  const gasPrice = await publicClient.getGasPrice();

  process.stdout.write(
    [
      "Phase 2.5b — bridge ETH L1 (Eth Sepolia) → L2 (Base Sepolia)",
      `L1 chain id:           ${chainId}`,
      `L1 bridge contract:    ${L1_BRIDGE} (identity verified)`,
      `Sender (L1 + L2):      ${wallets.A.address}`,
      `Wallet A L1 balance:   ${formatEth(balanceA)} ETH`,
      `Amount to bridge:      ${formatEth(AMOUNT_WEI)} ETH (hardcoded)`,
      `Gas price:             ${gasPrice.toString()} wei`,
      "",
    ].join("\n"),
  );

  // Build the calldata first so we can estimate gas + simulate.
  const data = encodeFunctionData({
    abi: BRIDGE_ETH_TO_ABI,
    functionName: "bridgeETHTo",
    args: [wallets.A.address, 200_000, "0x"],
  });

  let gasUnits;
  try {
    gasUnits = await publicClient.estimateGas({
      account: wallets.A.address,
      to: L1_BRIDGE,
      value: AMOUNT_WEI,
      data,
    });
  } catch (err) {
    fail(`gas estimation failed: ${stripSecrets(err)}`);
  }
  const estFee = gasUnits * gasPrice;
  process.stdout.write(
    `Est. gas units:        ${gasUnits.toString()}\nEst. fee:              ${formatEth(estFee)} ETH\n\n`,
  );

  if (balanceA < AMOUNT_WEI + estFee * 2n) {
    fail(
      `Wallet A balance ${formatEth(balanceA)} ETH < amount + 2× fee buffer ${formatEth(AMOUNT_WEI + estFee * 2n)} ETH`,
    );
  }

  // Dry-run via `call` — this returns the raw bytes from the L1
  // bridge call. We don't decode them; we only care that the call
  // does not revert.
  try {
    await publicClient.call({
      account: wallets.A.address,
      to: L1_BRIDGE,
      value: AMOUNT_WEI,
      data,
    });
  } catch (err) {
    fail(`simulation reverted: ${stripSecrets(err)}`);
  }
  process.stdout.write("simulation clean — proceeding to broadcast.\n\n");

  const walletClient = createWalletClient({
    account: wallets.A.account,
    chain: sepolia,
    transport: http(l1RpcUrl()),
  });
  if (walletClient.account.address.toLowerCase() !== EXPECTED_A) {
    fail("viem walletClient resolved unexpected sender");
  }

  let txHash;
  try {
    txHash = await walletClient.sendTransaction({
      to: L1_BRIDGE,
      value: AMOUNT_WEI,
      data,
    });
  } catch (err) {
    fail(`sendTransaction failed: ${stripSecrets(err)}`);
  }
  process.stdout.write(`L1 tx submitted: ${txHash}\nwaiting for confirmation...\n`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const finalA = await publicClient.getBalance({ address: wallets.A.address });
  process.stdout.write(
    [
      "",
      "L1 broadcast complete",
      `L1 tx hash:            ${receipt.transactionHash}`,
      `L1 status:             ${receipt.status}`,
      `L1 block:              ${receipt.blockNumber.toString()}`,
      `L1 gas used:           ${receipt.gasUsed.toString()}`,
      `Wallet A L1 balance:   ${formatEth(finalA)} ETH (after)`,
      "",
      "The ETH will arrive on Base Sepolia at the same address",
      "after the OP-stack L2 sequencer picks up the deposit",
      "(typically 2-5 minutes). Use `scripts/rehearsal-wait-l2-balance.mjs`",
      "to poll until it lands.",
      "",
    ].join("\n"),
  );
  if (receipt.status !== "success") fail(`L1 tx reverted; status=${receipt.status}`);
}

main().catch((err) => fail(`unhandled: ${stripSecrets(err)}`));
