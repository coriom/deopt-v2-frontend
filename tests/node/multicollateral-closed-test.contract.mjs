// DEOPT_WETH_COLLATERAL_CLOSED_TEST_V1 Part J — frontend closed-test
// gate contract.
//
// Asserts:
//   * default behaviour hides WETH controls even when the row is
//     present in the balances list;
//   * with the env flag set, WETH controls appear ONLY when the
//     backend row also declares `is_deposit_enabled` /
//     `is_withdrawal_enabled` true;
//   * USDC controls follow the classic V1 rule and are never
//     affected by the closed-test flag.
//
// Run: `node --test tests/node/multicollateral-closed-test.contract.mjs`

import { test } from "node:test";
import assert from "node:assert/strict";

const ENV_VAR = "NEXT_PUBLIC_MULTICOLLATERAL_CLOSED_TEST_ENABLED";

function withFlag(value, fn) {
  const prev = process.env[ENV_VAR];
  process.env[ENV_VAR] = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env[ENV_VAR];
    else process.env[ENV_VAR] = prev;
  }
}

function withFlagUnset(fn) {
  const prev = process.env[ENV_VAR];
  delete process.env[ENV_VAR];
  try {
    return fn();
  } finally {
    if (prev !== undefined) process.env[ENV_VAR] = prev;
  }
}

async function loadMod() {
  return await import("../../src/lib/multicollateral-closed-test.ts");
}

const usdcRow = {
  token: "0x1111111111111111111111111111111111111111",
  symbol: "USDC",
  balance: "10000",
  is_deposit_enabled: true,
  is_withdrawal_enabled: true,
  is_collateral_active: true,
};

const wethRow = {
  token: "0x4200000000000000000000000000000000000006",
  symbol: "WETH",
  balance: "2",
  is_deposit_enabled: true,
  is_withdrawal_enabled: true,
};

const wethPausedRow = {
  token: "0x4200000000000000000000000000000000000006",
  symbol: "WETH",
  balance: "2",
  is_deposit_enabled: false,
  is_withdrawal_enabled: false,
};

test("closed-test flag defaults to inert", async () => {
  await withFlagUnset(async () => {
    const mod = await loadMod();
    assert.equal(mod.isMulticollateralClosedTestEnabled(), false);
    assert.equal(mod.shouldRenderBalanceRow(wethRow), false);
    assert.equal(mod.shouldExposeDeposit(wethRow), false);
    assert.equal(mod.shouldExposeWithdraw(wethRow), false);
  });
});

test("USDC controls always render, regardless of the flag", async () => {
  const mod = await loadMod();
  await withFlagUnset(async () => {
    assert.equal(mod.shouldRenderBalanceRow(usdcRow), true);
    assert.equal(mod.shouldExposeDeposit(usdcRow), true);
    assert.equal(mod.shouldExposeWithdraw(usdcRow), true);
  });
  await withFlag("true", async () => {
    assert.equal(mod.shouldRenderBalanceRow(usdcRow), true);
    assert.equal(mod.shouldExposeDeposit(usdcRow), true);
    assert.equal(mod.shouldExposeWithdraw(usdcRow), true);
  });
});

test("flag ON + backend enabled → WETH controls appear", async () => {
  const mod = await loadMod();
  await withFlag("true", async () => {
    assert.equal(mod.isMulticollateralClosedTestEnabled(), true);
    assert.equal(mod.shouldRenderBalanceRow(wethRow), true);
    assert.equal(mod.shouldExposeDeposit(wethRow), true);
    assert.equal(mod.shouldExposeWithdraw(wethRow), true);
  });
});

test("flag ON + backend paused → WETH row hidden", async () => {
  const mod = await loadMod();
  await withFlag("true", async () => {
    assert.equal(mod.shouldRenderBalanceRow(wethPausedRow), false);
    assert.equal(mod.shouldExposeDeposit(wethPausedRow), false);
    assert.equal(mod.shouldExposeWithdraw(wethPausedRow), false);
  });
});

test("flag ON + backend deposit-only → deposit exposed, withdraw hidden", async () => {
  const mod = await loadMod();
  await withFlag("true", async () => {
    const row = { ...wethRow, is_withdrawal_enabled: false };
    assert.equal(mod.shouldRenderBalanceRow(row), true, "still rendered because deposit is open");
    assert.equal(mod.shouldExposeDeposit(row), true);
    assert.equal(mod.shouldExposeWithdraw(row), false);
  });
});

test("flag accepts multiple truthy forms", async () => {
  const mod = await loadMod();
  for (const v of ["true", "TRUE", "True", "1", "yes", "YES"]) {
    await withFlag(v, async () => {
      assert.equal(
        mod.isMulticollateralClosedTestEnabled(),
        true,
        `value '${v}' must activate`,
      );
    });
  }
});

test("flag rejects ambiguous values", async () => {
  const mod = await loadMod();
  for (const v of ["", "0", "no", "false", "maybe", "on"]) {
    await withFlag(v, async () => {
      assert.equal(
        mod.isMulticollateralClosedTestEnabled(),
        false,
        `value '${v}' must NOT activate`,
      );
    });
  }
});

test("production posture: WETH never depositable without both gates", async () => {
  const mod = await loadMod();
  // Scenario 1: backend says WETH deposit-enabled but frontend flag OFF.
  await withFlagUnset(async () => {
    assert.equal(mod.shouldExposeDeposit(wethRow), false);
  });
  // Scenario 2: frontend flag ON but backend says WETH deposit-disabled.
  await withFlag("true", async () => {
    const disabled = { ...wethRow, is_deposit_enabled: false };
    assert.equal(mod.shouldExposeDeposit(disabled), false);
  });
});
