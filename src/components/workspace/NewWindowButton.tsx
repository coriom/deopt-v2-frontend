"use client";

// Navbar `+` button — opens a fresh /custom workspace in a new
// window so operators can pin an extra Custom board on a
// secondary monitor without leaving their main terminal.
//
// Chrome level depends on the runtime:
//   * When the site is INSTALLED AS A PWA (via the browser's
//     "Install DeOpt" prompt), `window.open` from the installed
//     app launches a standalone frame — no address bar, no
//     tab strip, no browser buttons. Just the terminal. This
//     is the true "application mode" the operator asked for.
//   * When the site is only opened as a regular tab,
//     `popup=yes,noopener,noreferrer,width=...,height=...`
//     opens a chromeless detached popup — narrower than a full
//     tab but still shows the browser's minimal chrome (address
//     bar visible; that is browser-enforced, no `location=no`
//     flag can hide it since 2015 for phishing protection).
//
// The popup is sized against `window.screen` so it opens at a
// reasonable working area (75 % of the current screen). Users can
// then drag / resize it freely.

export function NewWindowButton() {
  const openWorkspaceWindow = () => {
    if (typeof window === "undefined") return;
    const screenW = window.screen?.availWidth ?? 1440;
    const screenH = window.screen?.availHeight ?? 900;
    const w = Math.max(800, Math.round(screenW * 0.75));
    const h = Math.max(600, Math.round(screenH * 0.75));
    const left = Math.max(0, Math.round((screenW - w) / 2));
    const top = Math.max(0, Math.round((screenH - h) / 2));
    // Detect PWA standalone mode — when the parent window itself
    // is running as an installed PWA, `matchMedia("(display-mode:
    // standalone)")` returns true. In that case the child window
    // inherits the app frame and the operator gets a chromeless
    // window automatically.
    const inStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ?? false;
    // `noopener` prevents the opened window from touching
    // `window.opener` — no reverse control from the new window
    // back into the parent.
    window.open(
      "/window",
      "_blank",
      `popup=yes,noopener,noreferrer,width=${w},height=${h},left=${left},top=${top}`,
    );
    // Non-blocking, best-effort console hint the first time the
    // user clicks + from a regular tab session (not standalone).
    // Silenced once the site is installed. Never surfaces UI copy
    // in the navbar itself.
    if (!inStandalone && !window.sessionStorage.getItem("deopt-pwa-hint")) {
      window.sessionStorage.setItem("deopt-pwa-hint", "1");
      console.info(
        "[DeOpt] Tip: install DeOpt as an app (browser menu → 'Install DeOpt') to open new workspace windows without any browser chrome.",
      );
    }
  };

  return (
    <button
      type="button"
      onClick={openWorkspaceWindow}
      data-testid="navbar-new-window-button"
      aria-label="Open a new workspace window"
      title="Open a new workspace window (install DeOpt for full app mode)"
      className="cursor-pointer rounded border border-transparent px-2 py-0.5 text-[14px] font-semibold leading-none text-zinc-100 hover:border-zinc-700 hover:text-white"
    >
      +
    </button>
  );
}
