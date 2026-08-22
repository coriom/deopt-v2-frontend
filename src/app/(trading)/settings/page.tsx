export const metadata = {
  title: "Settings — DeOpt public testnet beta",
};

export default function SettingsPage() {
  return (
    <div
      data-testid="settings-page"
      className="flex h-full min-h-0 w-full flex-col"
    >
      {/* Contenu de la page — vide pour l'instant, à construire */}
      <div className="min-h-0 flex-1" />

      {/* Bandeau inférieur — placeholder ancré en bas de page,
          prêt à recevoir les actions (Save / Reset / ...) et un
          statut discret quand la surface Settings sera construite. */}
      <footer
        data-testid="settings-page-footer"
        className="flex h-10 shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-950 px-3 text-[11px] text-zinc-500"
      >
        <span data-testid="settings-page-footer-status">
          {/* status placeholder */}
        </span>
        <div
          data-testid="settings-page-footer-actions"
          className="flex items-center gap-2"
        >
          {/* action buttons placeholder */}
        </div>
      </footer>
    </div>
  );
}
