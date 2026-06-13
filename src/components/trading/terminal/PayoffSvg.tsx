"use client";

interface PayoffSvgProps {
  isCall: boolean;
  isBuy: boolean;
  strikeLabel: string;
}

/**
 * Tiny self-contained payoff visualization (no chart lib).
 *
 * Renders 4 archetypal lines: long call, short call, long put, short put.
 * Axis is conceptual — no live underlying-price scale; the strike is
 * labeled at the kink. Public testnet beta posture: this is a teaching
 * aid, not a live PnL chart.
 */
export function PayoffSvg({ isCall, isBuy, strikeLabel }: PayoffSvgProps) {
  // Coordinate system: 0..200 horizontal (underlying price; strike at 100).
  // 50 vertical center; up = profit, down = loss.
  const W = 200;
  const H = 100;
  const Y0 = 60; // zero PnL line
  const STRIKE_X = 100;

  // Build path based on (isCall, isBuy).
  let path = "";
  if (isCall && isBuy) {
    path = `M 0 ${Y0 + 12} L ${STRIKE_X} ${Y0 + 12} L ${W} ${Y0 - 30}`;
  } else if (isCall && !isBuy) {
    path = `M 0 ${Y0 - 12} L ${STRIKE_X} ${Y0 - 12} L ${W} ${Y0 + 30}`;
  } else if (!isCall && isBuy) {
    path = `M 0 ${Y0 - 30} L ${STRIKE_X} ${Y0 + 12} L ${W} ${Y0 + 12}`;
  } else {
    path = `M 0 ${Y0 + 30} L ${STRIKE_X} ${Y0 - 12} L ${W} ${Y0 - 12}`;
  }

  return (
    <div
      data-testid="payoff-svg"
      data-is-call={isCall ? "true" : "false"}
      data-is-buy={isBuy ? "true" : "false"}
      className="rounded border border-zinc-800 bg-black/40 p-3"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Payoff diagram for ${isBuy ? "long" : "short"} ${isCall ? "call" : "put"}`}
        className="h-32 w-full"
      >
        {/* Zero PnL axis */}
        <line
          x1="0"
          x2={W}
          y1={Y0}
          y2={Y0}
          stroke="#3f3f46"
          strokeWidth="0.5"
        />
        {/* Strike vertical guide */}
        <line
          x1={STRIKE_X}
          x2={STRIKE_X}
          y1={10}
          y2={H - 10}
          stroke="#27272a"
          strokeDasharray="2,3"
          strokeWidth="0.5"
        />
        {/* Payoff curve */}
        <path d={path} stroke="#10b981" strokeWidth="1.5" fill="none" />
        {/* Axis labels */}
        <text x={STRIKE_X} y={H - 2} fontSize="6" textAnchor="middle" fill="#a1a1aa">
          strike {strikeLabel}
        </text>
        <text x="2" y="9" fontSize="6" fill="#6ee7b7">
          + profit
        </text>
        <text x="2" y={H - 2} fontSize="6" fill="#fca5a5">
          − loss
        </text>
      </svg>
      <p className="mt-2 text-[10px] text-zinc-500">
        Schematic only — no live underlying price scale. Real PnL depends on
        the broadcast oracle reading at settlement and the testnet mUSDC
        collateral path. Testnet only; no real funds.
      </p>
    </div>
  );
}
