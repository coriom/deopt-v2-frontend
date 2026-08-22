"use client";

// SUBACCOUNTS-FRONTEND-SWITCHER-V1 — Derive-like account selector.
//
// Renders next to the wallet button when a wallet is connected. Shows
// the active subaccount label, a dropdown listing every subaccount
// the backend returned for the connected wallet, and Create + Rename
// actions. Never shows fake rows — if the backend errors we show an
// honest warning and fall back to Account 1 for legacy code paths.
//
// Scoping copy: the switcher explicitly documents that only Options
// orderbook activity is subaccount-scoped today. RFQ, Perps, WS
// payloads, balances, and margin are not scoped by this milestone.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet, type Subaccount } from "@/lib/wallet";
import { TradingApiError } from "@/lib/trading-api";

/**
 * SUBACCOUNTS-RENAME-RUNTIME-CRASH-V1 — small hook that returns a
 * ref which flips to `false` when the component unmounts. Modals use
 * it to skip `setState` calls that would otherwise fire after the
 * parent closes the modal, which surfaces in React dev mode as
 * "Can't perform a React state update on an unmounted component"
 * and reads to users as a runtime crash in the dev overlay.
 */
function useIsMountedRef() {
  const ref = useRef(true);
  useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return ref;
}

function labelFor(sub: Subaccount): string {
  if (sub.name && sub.name.trim().length > 0) {
    return `${sub.display_name} · ${sub.name}`;
  }
  return sub.display_name;
}

export function SubaccountSwitcher() {
  const {
    address,
    subaccounts,
    activeSubaccount,
    activeSubaccountId,
    isLoadingSubaccounts,
    subaccountsError,
    setActiveSubaccountId,
    createSubaccount,
    renameSubaccount,
    refreshSubaccounts,
  } = useWallet();

  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  // Hide entirely when the wallet is disconnected — the WalletConnectButton
  // owns the "not connected" state and rendering a "no accounts" skeleton
  // next to it would suggest fake state.
  if (!address) return null;

  const activeLabel = activeSubaccount
    ? labelFor(activeSubaccount)
    : `Account ${activeSubaccountId}`;

  return (
    <div
      ref={rootRef}
      data-testid="subaccount-switcher"
      className="relative inline-block"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="subaccount-switcher-trigger"
        data-active-subaccount-id={activeSubaccountId}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-2 rounded border border-transparent px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
        title="Switch subaccount"
      >
        <span
          data-testid="active-subaccount-label"
          className="font-mono"
        >
          {activeLabel}
        </span>
        <span aria-hidden="true" className="text-zinc-400">
          ▾
        </span>
      </button>
      {open ? (
        <SwitcherMenu
          subaccounts={subaccounts}
          activeSubaccountId={activeSubaccountId}
          isLoadingSubaccounts={isLoadingSubaccounts}
          subaccountsError={subaccountsError}
          onSelect={(id) => {
            setActiveSubaccountId(id);
            setOpen(false);
          }}
          onCreate={() => {
            setCreateOpen(true);
            setOpen(false);
          }}
          onRename={() => {
            setRenameOpen(true);
            setOpen(false);
          }}
          onRetry={() => void refreshSubaccounts()}
        />
      ) : null}
      {createOpen ? (
        <CreateSubaccountModal
          onClose={() => setCreateOpen(false)}
          onCreate={createSubaccount}
        />
      ) : null}
      {renameOpen && activeSubaccount ? (
        <RenameSubaccountModal
          key={`rename-${activeSubaccount.subaccount_id}`}
          active={activeSubaccount}
          onClose={() => setRenameOpen(false)}
          // Capture the id here — the arrow captures the immediate
          // reference so a rerender that briefly nulls
          // `activeSubaccount` cannot throw `Cannot read properties of
          // null` when the user's submit click resolves.
          onRename={(subaccountId => (name: string) =>
            renameSubaccount(subaccountId, name))(activeSubaccount.subaccount_id)}
        />
      ) : null}
    </div>
  );
}

function SwitcherMenu(props: {
  subaccounts: Subaccount[];
  activeSubaccountId: number;
  isLoadingSubaccounts: boolean;
  subaccountsError: string | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onRename: () => void;
  onRetry: () => void;
}) {
  const {
    subaccounts,
    activeSubaccountId,
    isLoadingSubaccounts,
    subaccountsError,
    onSelect,
    onCreate,
    onRename,
    onRetry,
  } = props;

  return (
    <div
      role="menu"
      data-testid="subaccount-switcher-menu"
      className="absolute right-0 z-30 mt-1 w-72 rounded border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
    >
      {subaccountsError ? (
        <div
          data-testid="subaccount-switcher-error"
          className="border-b border-red-300 bg-red-50 px-3 py-2 text-[11px] text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          <p>{subaccountsError}</p>
          <button
            type="button"
            onClick={onRetry}
            data-testid="subaccount-switcher-retry"
            className="mt-1 text-[10px] underline"
          >
            Retry
          </button>
        </div>
      ) : null}
      {isLoadingSubaccounts && subaccounts.length === 0 ? (
        <p
          data-testid="subaccount-switcher-loading"
          className="px-3 py-2 text-[11px] text-zinc-500"
        >
          Loading…
        </p>
      ) : subaccounts.length === 0 ? (
        <p
          data-testid="subaccount-switcher-empty"
          className="px-3 py-2 text-[11px] text-zinc-500"
        >
          No subaccounts yet.
        </p>
      ) : (
        <ul className="max-h-64 overflow-y-auto py-1">
          {subaccounts.map((sub) => {
            const active = sub.subaccount_id === activeSubaccountId;
            return (
              <li key={sub.subaccount_id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => onSelect(sub.subaccount_id)}
                  data-testid={`subaccount-option-${sub.subaccount_id}`}
                  data-active={active ? "true" : "false"}
                  className={
                    "flex w-full items-center justify-between px-3 py-1.5 text-left text-xs font-mono text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 " +
                    (active ? "bg-zinc-50 dark:bg-zinc-800/60" : "")
                  }
                >
                  <span>{labelFor(sub)}</span>
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="text-emerald-500"
                      data-testid={`subaccount-option-${sub.subaccount_id}-check`}
                    >
                      ✓
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center justify-between border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <button
          type="button"
          onClick={onCreate}
          data-testid="subaccount-create"
          className="text-[11px] font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          + Create subaccount
        </button>
        <button
          type="button"
          onClick={onRename}
          data-testid="subaccount-rename"
          disabled={subaccounts.length === 0}
          className="text-[11px] font-medium text-zinc-600 hover:underline disabled:cursor-not-allowed disabled:text-zinc-400 dark:text-zinc-400 dark:disabled:text-zinc-600"
        >
          Rename active
        </button>
      </div>
    </div>
  );
}

const MAX_SUBACCOUNT_NAME_LEN = 32;

function CreateSubaccountModal(props: {
  onClose: () => void;
  onCreate: (name?: string | null) => Promise<Subaccount>;
}) {
  const { onClose, onCreate } = props;
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useIsMountedRef();

  const trimmed = useMemo(() => name.trim(), [name]);
  const nameTooLong = trimmed.length > MAX_SUBACCOUNT_NAME_LEN;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting || nameTooLong) return;
      setSubmitting(true);
      setError(null);
      try {
        await onCreate(trimmed.length > 0 ? trimmed : null);
        // Order matters: settle the loading state BEFORE onClose(),
        // otherwise React unmounts the modal and the finally block
        // fires setState-after-unmount (surfaces in dev as a runtime
        // crash in the error overlay).
        if (mountedRef.current) setSubmitting(false);
        onClose();
        return;
      } catch (err) {
        const message =
          err instanceof TradingApiError
            ? err.message
            : (err as Error).message || "Failed to create subaccount";
        if (mountedRef.current) {
          setError(message);
          setSubmitting(false);
        }
      }
    },
    [mountedRef, nameTooLong, onClose, onCreate, submitting, trimmed],
  );

  return (
    <ModalShell testid="subaccount-create-modal" onClose={onClose}>
      <h2 className="mb-2 text-sm font-semibold">Create subaccount</h2>
      <p className="mb-3 text-[11px] text-zinc-500">
        Isolates Options orderbook activity from your other subaccounts.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label className="text-[11px] text-zinc-600 dark:text-zinc-300">
          Name (optional)
          <input
            type="text"
            value={name}
            maxLength={MAX_SUBACCOUNT_NAME_LEN}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alpha book"
            data-testid="subaccount-create-name"
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>
        {nameTooLong ? (
          <p
            data-testid="subaccount-create-name-error"
            className="text-[10px] text-red-500"
          >
            Name must be {MAX_SUBACCOUNT_NAME_LEN} characters or fewer.
          </p>
        ) : null}
        {error ? (
          <p
            data-testid="subaccount-create-error"
            role="alert"
            className="rounded border border-red-500/40 bg-red-50 px-2 py-1 text-[11px] text-red-800 dark:bg-red-950/40 dark:text-red-100"
          >
            {error}
          </p>
        ) : null}
        <p
          data-testid="subaccount-create-signature-note"
          className="text-[11px] text-zinc-500"
        >
          You&rsquo;ll be asked to sign a message to prove you own this wallet.
          No gas required.
        </p>
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            data-testid="subaccount-create-cancel"
            className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || nameTooLong}
            data-testid="subaccount-create-submit"
            className="rounded bg-emerald-500 px-3 py-1 text-xs font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-500"
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function RenameSubaccountModal(props: {
  active: Subaccount;
  onClose: () => void;
  onRename: (name: string) => Promise<Subaccount>;
}) {
  const { active, onClose, onRename } = props;
  const [name, setName] = useState(active.name ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useIsMountedRef();

  const trimmed = useMemo(() => name.trim(), [name]);
  const nameEmpty = trimmed.length === 0;
  const nameTooLong = trimmed.length > MAX_SUBACCOUNT_NAME_LEN;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting || nameEmpty || nameTooLong) return;
      setSubmitting(true);
      setError(null);
      try {
        await onRename(trimmed);
        // Order matters: settle the loading state BEFORE onClose(),
        // otherwise React unmounts the modal and the finally block
        // fires setState-after-unmount (surfaces in dev as a runtime
        // crash in the error overlay).
        if (mountedRef.current) setSubmitting(false);
        onClose();
        return;
      } catch (err) {
        const message =
          err instanceof TradingApiError
            ? err.message
            : (err as Error).message || "Failed to rename subaccount";
        if (mountedRef.current) {
          setError(message);
          setSubmitting(false);
        }
      }
    },
    [mountedRef, nameEmpty, nameTooLong, onClose, onRename, submitting, trimmed],
  );

  return (
    <ModalShell testid="subaccount-rename-modal" onClose={onClose}>
      <h2 className="mb-2 text-sm font-semibold">
        Rename {active.display_name}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label className="text-[11px] text-zinc-600 dark:text-zinc-300">
          New name
          <input
            type="text"
            value={name}
            maxLength={MAX_SUBACCOUNT_NAME_LEN}
            onChange={(e) => setName(e.target.value)}
            data-testid="subaccount-rename-name"
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>
        {nameTooLong ? (
          <p
            data-testid="subaccount-rename-name-error"
            className="text-[10px] text-red-500"
          >
            Name must be {MAX_SUBACCOUNT_NAME_LEN} characters or fewer.
          </p>
        ) : null}
        {error ? (
          <p
            data-testid="subaccount-rename-error"
            role="alert"
            className="rounded border border-red-500/40 bg-red-50 px-2 py-1 text-[11px] text-red-800 dark:bg-red-950/40 dark:text-red-100"
          >
            {error}
          </p>
        ) : null}
        <p
          data-testid="subaccount-rename-signature-note"
          className="text-[11px] text-zinc-500"
        >
          You&rsquo;ll be asked to sign a message to prove you own this wallet.
          No gas required.
        </p>
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            data-testid="subaccount-rename-cancel"
            className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || nameEmpty || nameTooLong}
            data-testid="subaccount-rename-submit"
            className="rounded bg-emerald-500 px-3 py-1 text-xs font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-500"
          >
            {submitting ? "Renaming…" : "Rename"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell(props: {
  testid: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { testid, onClose, children } = props;
  return (
    <div
      data-testid={testid}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded border border-zinc-300 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        {children}
      </div>
    </div>
  );
}
