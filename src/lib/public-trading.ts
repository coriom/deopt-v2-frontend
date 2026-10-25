// This frontend release is a view-only production build while DeOpt
// governance and the trading backend remain in maintenance.
// A later trading release requires a reviewed source change.
export function isPublicTradingEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}
