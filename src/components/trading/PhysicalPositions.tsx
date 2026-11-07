"use client";

import { useCallback, useEffect, useState } from "react";
import { createPublicClient, custom, encodeFunctionData, parseAbi, type Address, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { useWallet } from "@/lib/wallet";

const erc20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);
const covered = parseAbi([
  "function exercise(address,uint256)",
  "function releaseExpired(address,address,uint256)",
]);
const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const enabled = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_OPTIONS_PHYSICAL_MODE === "1";

type Proof = { event: string; quantity: string; tx_hash: Hex; block_hash: Hex; log_index: number };
type Lot = {
  buyer: Address; seller: Address; filled_contracts: string; open_contracts: string;
  exercised_contracts: string; lapsed_contracts: string; waived_contracts: string;
  premium_native: string; strike_paid_native: string; underlying_locked_native: string;
  underlying_delivered_native: string; underlying_returned_native: string;
  fee_native: string | null; proof: Proof[];
};
type PhysicalData = {
  address: Address; chain_id: number; registry: Address; engine: Address; series_id: string;
  option_id: string; underlying: Address; quote: Address;
  underlying_per_contract_native: string; strike_per_contract_native: string;
  expiry: number; exercise_deadline: number; chain_timestamp: number; positions: Lot[];
};

function validPayload(value: PhysicalData, address: Address): boolean {
  return value?.chain_id === 84532 && value.address?.toLowerCase() === address.toLowerCase()
    && [value.registry, value.engine, value.underlying, value.quote].every((entry) => addressPattern.test(entry))
    && /^0x[0-9a-fA-F]{64}$/.test(value.series_id)
    && Array.isArray(value.positions)
    && value.positions.every((row) => addressPattern.test(row.buyer) && addressPattern.test(row.seller)
      && /^\d+$/.test(row.open_contracts) && Array.isArray(row.proof));
}

export function PhysicalPositions() {
  const { address, walletClient, isExpectedChain } = useWallet();
  const [data, setData] = useState<PhysicalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<Hex | null>(null);
  const [balances, setBalances] = useState<{ weth: string; usdc: string } | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !address) return null;
    try {
      const response = await fetch(`/api/deopt/options/accounts/${address}/physical-positions`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Physical positions unavailable (HTTP ${response.status})`);
      const envelope = await response.json() as { data: PhysicalData };
      if (!validPayload(envelope.data, address)) throw new Error("Physical position identity mismatch");
      setData(envelope.data);
      setError(null);
      return envelope.data;
    } catch (cause) {
      setData(null);
      setError(cause instanceof Error ? cause.message : "Physical positions unavailable");
      return null;
    }
  }, [address]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const ticker = window.setInterval(() => void load(), 2_000);
    return () => window.clearInterval(ticker);
  }, [load]);

  const act = async (kind: "exercise" | "release", lot: Lot) => {
    if (!enabled || !address || !walletClient || !isExpectedChain || !data || !window.ethereum) return;
    const open = BigInt(lot.open_contracts);
    if (open < BigInt(1)) return;
    const client = createPublicClient({ chain: baseSepolia, transport: custom(window.ethereum) });
    setError(null);
    setPending(kind === "exercise" ? "Checking strike funds" : "Submitting restitution");
    try {
      if (kind === "exercise") {
        if (address.toLowerCase() !== lot.buyer.toLowerCase()
            || data.chain_timestamp < data.expiry || data.chain_timestamp >= data.exercise_deadline) {
          throw new Error("Exercise is outside the contractual window");
        }
        const strike = BigInt(data.strike_per_contract_native);
        const balance = await client.readContract({ address: data.quote, abi: erc20, functionName: "balanceOf", args: [address] });
        if (balance < strike) throw new Error("Insufficient mUSDC for the strike");
        const allowance = await client.readContract({ address: data.quote, abi: erc20, functionName: "allowance", args: [address, data.engine] });
        if (allowance < strike) {
          setPending("Approving exact strike amount");
          const approval = await walletClient.sendTransaction({
            account: address, chain: baseSepolia, to: data.quote,
            data: encodeFunctionData({ abi: erc20, functionName: "approve", args: [data.engine, strike] }),
          });
          const approved = await client.waitForTransactionReceipt({ hash: approval });
          if (approved.status !== "success") throw new Error("mUSDC approval reverted");
        }
        setPending("Submitting physical exercise");
      } else if (address.toLowerCase() !== lot.seller.toLowerCase() || data.chain_timestamp < data.exercise_deadline) {
        throw new Error("Collateral return is not yet permitted");
      }
      const tx = await walletClient.sendTransaction({
        account: address, chain: baseSepolia, to: data.engine,
        data: kind === "exercise"
          ? encodeFunctionData({ abi: covered, functionName: "exercise", args: [lot.seller, BigInt(1)] })
          : encodeFunctionData({ abi: covered, functionName: "releaseExpired", args: [lot.buyer, lot.seller, BigInt(1)] }),
      });
      setLastTx(tx);
      setPending("Waiting for contract confirmation");
      const receipt = await client.waitForTransactionReceipt({ hash: tx });
      if (receipt.status !== "success") throw new Error("Physical transaction reverted");
      setPending("Confirmed on Anvil; awaiting indexer");
      const [weth, usdc] = await Promise.all([
        client.readContract({ address: data.underlying, abi: erc20, functionName: "balanceOf", args: [address] }),
        client.readContract({ address: data.quote, abi: erc20, functionName: "balanceOf", args: [address] }),
      ]);
      setBalances({ weth: weth.toString(), usdc: usdc.toString() });
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const refreshed = await load();
        if (refreshed?.positions.some((position) => position.proof.some((proof) => proof.tx_hash.toLowerCase() === tx.toLowerCase()))) {
          setPending(null);
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
      throw new Error("Transaction confirmed, but its canonical indexation is still pending. Refresh before taking another action.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Physical transaction failed");
      setPending(null);
    }
  };

  if (!enabled || !address) return null;
  return (
    <section data-testid="physical-positions" className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Covered Calls · physical delivery</h3>
        <button type="button" onClick={() => void load()} data-testid="physical-refresh" className="text-emerald-200">Refresh</button>
      </div>
      {error && <p role="alert" data-testid="physical-error" className="mt-2 text-amber-200">{error}</p>}
      {pending && <p data-testid="physical-pending" className="mt-2 text-amber-200">{pending}</p>}
      {lastTx && <p data-testid="physical-tx" className="mt-2 font-mono">{lastTx}</p>}
      {balances && <p data-testid="physical-balances" className="mt-2">Wallet: {balances.weth} mWETH native · {balances.usdc} mUSDC native</p>}
      {data && <p className="mt-2">Series {data.series_id.slice(0, 10)} · strike {data.strike_per_contract_native} mUSDC native per Call · {data.underlying_per_contract_native} mWETH native per Call · expiry {new Date(data.expiry * 1000).toISOString()} · exercise deadline {new Date(data.exercise_deadline * 1000).toISOString()}</p>}
      {data?.positions.map((lot) => {
        const key = `${lot.buyer.toLowerCase()}-${lot.seller.toLowerCase()}`;
        const canExercise = isExpectedChain && address.toLowerCase() === lot.buyer.toLowerCase()
          && BigInt(lot.open_contracts) > BigInt(0) && data.chain_timestamp >= data.expiry
          && data.chain_timestamp < data.exercise_deadline;
        const canRelease = isExpectedChain && address.toLowerCase() === lot.seller.toLowerCase()
          && BigInt(lot.open_contracts) > BigInt(0) && data.chain_timestamp >= data.exercise_deadline;
        return <div key={key} data-testid={`physical-lot-${key}`} className="mt-3 border-t border-zinc-800 pt-2">
          <p>{address.toLowerCase() === lot.buyer.toLowerCase() ? "LONG" : "SHORT"} · {lot.open_contracts} open / {lot.filled_contracts} filled · {lot.underlying_locked_native} mWETH native originally locked</p>
          <p data-testid="physical-flows">Premium {lot.premium_native} mUSDC native · strike paid {lot.strike_paid_native} mUSDC native · delivered {lot.underlying_delivered_native} mWETH native · returned {lot.underlying_returned_native} mWETH native · fee {lot.fee_native ?? "unverified"}</p>
          <p>Exercised {lot.exercised_contracts} · lapsed {lot.lapsed_contracts} · waived {lot.waived_contracts}</p>
          {canExercise && <button type="button" disabled={!!pending} onClick={() => void act("exercise", lot)} data-testid="physical-exercise" className="mt-2 rounded border border-emerald-500 px-2 py-1 text-emerald-200">Pay {data.strike_per_contract_native} mUSDC native and receive {data.underlying_per_contract_native} mWETH native</button>}
          {canRelease && <button type="button" disabled={!!pending} onClick={() => void act("release", lot)} data-testid="physical-release" className="mt-2 rounded border border-emerald-500 px-2 py-1 text-emerald-200">Return {data.underlying_per_contract_native} mWETH native after lapse</button>}
          <p data-testid="physical-provenance" className="mt-1 font-mono text-[10px] text-zinc-500">{lot.proof.map((p) => `${p.event} ${p.tx_hash.slice(0, 10)}:${p.log_index}`).join(" · ")}</p>
        </div>;
      })}
      {data?.positions.length === 0 && <p className="mt-2">No covered Call obligations for this wallet.</p>}
      <p className="mt-3 text-zinc-500">Quantities match the covered contract. Per-fill lot identity and fees remain unverified.</p>
    </section>
  );
}
