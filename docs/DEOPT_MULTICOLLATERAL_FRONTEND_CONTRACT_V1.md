# DEOPT_MULTICOLLATERAL_FRONTEND_CONTRACT_V1

Design + shipped type changes. No behaviour change today. Base +
USDC remain the only active runtime configuration.

## Purpose

Extend the frontend `Balance` / `BalancesData` type contract so that
a future backend response carrying multiple collateral assets
(USDC + WETH + cbBTC) can be rendered without a component rewrite.

## Wire-contract additions (all optional)

Every added field is optional so the current single-collateral
backend responses remain byte-compatible.

Per-row (`Balance`):

- `raw_usd_value_1e8?: DecimalString` — raw USD value pre-haircut.
- `risk_adjusted_usd_value_1e8?: DecimalString` — after collateral
  factor.
- `collateral_factor_bps?: number` — the factor actually applied.
- `liquidation_factor_bps?: number`.
- `is_deposit_enabled?: boolean` — vault-level deposit gate.
- `is_withdrawal_enabled?: boolean` — vault-level withdrawal gate.

Per-subaccount (`BalancesData.totals?: BalancesTotals`):

- `raw_value_usd_1e8?` — sum across all balances pre-haircut.
- `margin_value_usd_1e8?` — sum post-haircut.
- `liquidation_value_usd_1e8?` — sum with liquidation factor.

## Fail-closed rules for the deposit / withdraw UI

- `is_deposit_enabled === false` OR missing → the deposit form MUST
  NOT expose this token as depositable.
- `is_withdrawal_enabled === false` OR missing → withdraw form MUST
  NOT expose this token as withdrawable.
- These rules apply even if the token appears in the list with a
  non-zero balance (paused-deposit / open-withdrawal state).

## Target visual (informational; no components changed today)

```
Asset       Balance         Raw Value        Margin Value
USDC        10,000          $10,000.00       $10,000.00
WETH        2.500 (paused)  $7,500.00        $6,000.00
cbBTC       0.0500          $3,000.00        $2,100.00
─────────────────────────────────────────────────────────
                            Raw:   $20,500   Margin: $18,100
```

- USDC/WETH/cbBTC come from `balances[]`.
- `(paused)` badge derives from `is_deposit_enabled === false`.
- Totals row from `BalancesData.totals`.

## What is NOT changed

- `BalancesCard` component: iterator over `balances[]`, already
  ready to render N rows.
- Deposit / withdraw components: no change today. Adding a token
  selector is deferred until backend actually surfaces
  `is_deposit_enabled=true` for a non-USDC token.
- API client: no change today.

## What must NOT be exposed

- No selector for WETH / cbBTC on the deposit form until a backend
  response returns `is_deposit_enabled=true` for that token.
- No manual override / "advanced mode" toggle bypassing the gate.
- No mainnet chain (unchanged from V1).

## Verdict

`DEOPT_MULTICOLLATERAL_FRONTEND_CONTRACT_VALIDATED`
