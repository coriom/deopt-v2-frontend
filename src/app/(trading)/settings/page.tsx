export const metadata = {
  title: "Settings — DeOpt public testnet beta",
};

export default function SettingsPage() {
  // Intentionally empty — a fresh Settings surface is being built
  // from scratch. Keep the route mounted so the navbar gear link
  // never 404s while we iterate.
  return (
    <div
      data-testid="settings-page"
      className="flex h-full min-h-0 w-full flex-col"
    />
  );
}
