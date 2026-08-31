"use client";

// Navbar `+` button — opens a fresh /custom workspace in a detached
// popup window so operators can pin an extra Custom board on a
// secondary monitor without leaving their main terminal.
//
// Popup vs. tab:
//   * `window.open(url, "_blank", "popup=yes,...")` — most browsers
//     honour the `popup` feature and open a chromeless window
//     (no address bar, back button, extension icons). It is
//     detached from the tab strip immediately.
//   * If a browser or an extension forces the URL back into a tab
//     the code still works — the new window / tab loads
//     `/custom` correctly, just with extra chrome.
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
    // `noopener` prevents the opened window from touching
    // `window.opener` — no reverse control from the new window
    // back into the parent.
    window.open(
      "/custom",
      "_blank",
      `popup=yes,noopener,noreferrer,width=${w},height=${h},left=${left},top=${top}`,
    );
  };

  return (
    <button
      type="button"
      onClick={openWorkspaceWindow}
      data-testid="navbar-new-window-button"
      aria-label="Open a new workspace window"
      title="Open a new workspace in a detached window"
      className="cursor-pointer rounded border border-transparent px-2 py-0.5 text-[14px] font-semibold leading-none text-zinc-100 hover:border-zinc-700 hover:text-white"
    >
      +
    </button>
  );
}
