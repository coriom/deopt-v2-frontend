// OPTIONS-TWAP-ORDERS-V1 — strict opt-in flag helper.
//
// Options TWAP order type only surfaces in the Order Type dropdown
// (and the trading API's `/options/twap-orders` create call only
// fires) when `NEXT_PUBLIC_OPTIONS_TWAP_ENABLED=true` at build
// time. Default is `false`. Perps TWAP is out of scope for V1 and
// remains absent.

const ENV_KEY = "NEXT_PUBLIC_OPTIONS_TWAP_ENABLED";

function truthy(v: string | undefined | null): boolean {
  if (v === null || v === undefined) return false;
  const t = v.trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes";
}

export function isOptionsTwapEnabled(): boolean {
  return truthy(process.env[ENV_KEY]);
}

export const OPTIONS_TWAP_ENABLED_ENV = ENV_KEY;
