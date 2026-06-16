import { PlaceholderPage } from "@/components/PlaceholderPage";

export const metadata = {
  title: "Settings — DeOpt public testnet beta",
};

export default function SettingsPage() {
  return (
    <PlaceholderPage
      testid="settings-page"
      title="Settings"
      summary={
        <>
          A wallet-scoped settings surface is being prepared. There are no
          stored preferences today — workspace layouts persist in
          localStorage under the active wallet key and reset cleanly with a
          schema bump.
        </>
      }
      reliableNow={[
        "Workspace layouts persist locally per wallet (or anonymously). Use the workspace toolbar to add / arrange / remove widgets.",
        "There is no server-side preferences store and no telemetry opt-in / opt-out in this build.",
        "Wallet connection state is owned by your wallet provider — DeOpt does not store any session for you.",
      ]}
      landsLater={[
        "Per-wallet preferences (default workspace, default product, density, font choices).",
        "Notification routing for fills, expirations, oracle hiccups.",
        "Optional analytics opt-in with a clear scope statement.",
      ]}
    />
  );
}
