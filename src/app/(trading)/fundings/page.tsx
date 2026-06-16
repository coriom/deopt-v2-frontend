import { PlaceholderPage } from "@/components/PlaceholderPage";

export const metadata = {
  title: "Fundings — DeOpt public testnet beta",
};

export default function FundingsPage() {
  return (
    <PlaceholderPage
      testid="fundings-page"
      title="Fundings"
      summary={
        <>
          Funding history and the perpetuals funding-rate readout are being
          prepared for the public testnet beta. Perps are not live yet, so
          no real funding has been paid or received in this build.
        </>
      }
      reliableNow={[
        "Perps trading is not enabled in this testnet beta — the /perps workspace renders a placeholder layout, no live mark, no live funding rate.",
        "There is no funding accrual ledger today; the backend does not yet expose a funding-history endpoint.",
        "All mUSDC balances are testnet mocks with zero real-world value.",
      ]}
      landsLater={[
        "Per-perp funding-rate ticker with documented sample window + clamp policy.",
        "Wallet-level funding history (paid / received per epoch) once the perps executor ships.",
        "Cross-margin funding settlement once the cross-margin path lands.",
      ]}
    />
  );
}
