// TESTNET-AUTOMATED-SOLO-USER-JOURNEY-REHEARSAL-V1 — shared helpers.
//
// Loads the burner wallet file from `~/DEOPT/.local/...`, builds
// the viem chain + clients, exposes safety guards (chain id /
// recipient / amount) that must be satisfied before every sending
// helper. Never prints private keys; viem error messages are
// scrubbed of any `http(s)://...` URL substring.

import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_MAINNET_CHAIN_ID = 8453;

export const FAUCET_ADDRESS = "0xdf8969230142fbafbae7e4d5af3541db97526c4f";
export const TOKEN_ADDRESSES = Object.freeze({
  mUSDC: { address: "0x6eae407f5640b006fac9965182e238582a3b412e", decimals: 6 },
  mWETH: { address: "0x4deebc5f537f3b8ba0e3393807b4d699d72bdd02", decimals: 18 },
  mWBTC: { address: "0x9d871ac7595e8da271e866608e5145252047967c", decimals: 8 },
});

export const ERC20_BALANCE_OF_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
];

export const FAUCET_READ_ABI = [
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "cooldownSeconds", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "nextClaimAvailableAt",
    stateMutability: "view",
    inputs: [{ name: "caller", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
];

export const FAUCET_CLAIM_ABI = [
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [], outputs: [] },
];

const WALLET_FILE = `${homedir()}/DEOPT/.local/testnet-rehearsal-wallets.json`;

/**
 * Load + validate the burner wallet file. Refuses to proceed if
 * permissions are not `0600` (other users can read the keys).
 * Returns `{ A, B, C }` where each entry is `{ address, account }`
 * — `account` is a viem `Account` that holds the private key in
 * memory; never stringify it directly.
 */
export function loadBurnerWallets() {
  let st;
  try {
    st = statSync(WALLET_FILE);
  } catch {
    throw new Error(
      `wallet file missing at ${WALLET_FILE}; run "node scripts/gen-testnet-rehearsal-wallets.mjs" first`,
    );
  }
  const mode = st.mode & 0o777;
  if (mode !== 0o600) {
    throw new Error(
      `wallet file ${WALLET_FILE} has mode ${mode.toString(8)}; refusing to load (must be 0o600). Run: chmod 600 ${WALLET_FILE}`,
    );
  }
  const blob = JSON.parse(readFileSync(WALLET_FILE, "utf8"));
  if (blob.chainId !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error(`wallet file declares chainId=${blob.chainId}, expected ${BASE_SEPOLIA_CHAIN_ID}`);
  }
  const out = {};
  for (const label of ["A", "B", "C"]) {
    const entry = blob.wallets?.[label];
    if (!entry) continue;
    const account = privateKeyToAccount(entry.privateKey);
    if (account.address.toLowerCase() !== entry.address.toLowerCase()) {
      throw new Error(`wallet ${label} address mismatch between file and derived account`);
    }
    out[label] = { address: account.address, account };
  }
  return out;
}

export function rpcUrl() {
  return process.env.RPC_URL && process.env.RPC_URL !== ""
    ? process.env.RPC_URL
    : "https://sepolia.base.org";
}

export function makePublicClient() {
  return createPublicClient({ chain: baseSepolia, transport: http(rpcUrl()) });
}

export function makeWalletClient(account) {
  return createWalletClient({ account, chain: baseSepolia, transport: http(rpcUrl()) });
}

/**
 * Verify the connected RPC reports chain id 84532. Throws on any
 * other chain (mainnet 8453 explicitly mentioned).
 */
export async function assertChainBaseSepolia(client) {
  const id = await client.getChainId();
  if (id === BASE_MAINNET_CHAIN_ID) {
    throw new Error(`refusing chain id ${id} (Base mainnet). Base Sepolia only.`);
  }
  if (id !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error(`refusing chain id ${id}; expected ${BASE_SEPOLIA_CHAIN_ID} (Base Sepolia)`);
  }
  return id;
}

/**
 * Replace any `http(s)://...` substring in an error message with
 * `<redacted-url>` so an RPC URL bearing an API key never leaks
 * via a thrown viem error.
 */
export function stripSecrets(err) {
  const raw = (err && err.shortMessage) || (err && err.message) || String(err);
  return raw.replace(/https?:\/\/\S+/g, "<redacted-url>");
}

export function formatEth(wei) {
  // 18-decimal formatting with thousand separators on int part.
  const base = 10n ** 18n;
  const intPart = wei / base;
  const fracPart = wei % base;
  const intStr = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (fracPart === 0n) return intStr;
  const fracStr = fracPart.toString().padStart(18, "0").replace(/0+$/, "");
  return `${intStr}.${fracStr}`;
}
