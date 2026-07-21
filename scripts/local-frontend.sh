#!/usr/bin/env bash
# DEOPT-FRONTEND-PORT-PREFLIGHT-V1 — local `next dev` launcher.
#
# Reports what holds ports 3000 (default) and 3001 (fallback) — the
# ONLY two ports the DeOpt frontend uses locally — then starts
# Next.js on the first free slot. Refuses to start when both are
# taken instead of silently jumping to a third port.
#
# Port 3010 belongs to another project and is deliberately NOT part
# of DeOpt's port set. Do not add it.
#
# This script NEVER auto-kills a process. It reports PID + name +
# cmdline + cwd (when readable) so the operator can decide what to
# do. It also never prints environment variable values.
#
# Usage:
#   ./scripts/local-frontend.sh
#
# Dry-run (skip `npm run dev` exec; useful for testing this script):
#   DEOPT_LOCAL_FRONTEND_DRY_RUN=1 ./scripts/local-frontend.sh

set -euo pipefail

DEFAULT_PORT=3000
FALLBACK_PORT=3001
FRONTEND_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "${DEOPT_LOCAL_FRONTEND_DRY_RUN:-0}" == "1" ]]; then
  DRY_RUN=1
else
  DRY_RUN=0
fi

port_pids() {
  # Emit unique PIDs listening on the given TCP port. Empty output
  # means the port is free (from this user's viewpoint — a port owned
  # by another user shows a listener line without a pid= field, which
  # this function still counts as occupied via the has-listener check
  # in report_port).
  local port="$1"
  ss -H -ltnp "( sport = :${port} )" 2>/dev/null \
    | grep -oE 'pid=[0-9]+' \
    | cut -d= -f2 \
    | sort -u
}

port_has_listener() {
  local port="$1"
  local out
  out="$(ss -H -ltn "( sport = :${port} )" 2>/dev/null || true)"
  [[ -n "$out" ]]
}

describe_pid() {
  local pid="$1"
  local proc_dir="/proc/${pid}"
  if [[ ! -d "$proc_dir" ]]; then
    echo "  PID ${pid} — process no longer exists"
    return
  fi
  local comm cmd cwd
  comm="$(cat "${proc_dir}/comm" 2>/dev/null || echo unknown)"
  cmd="$(tr '\0' ' ' < "${proc_dir}/cmdline" 2>/dev/null | sed 's/[[:space:]]*$//')"
  [[ -z "$cmd" ]] && cmd="(no cmdline)"
  cwd="$(readlink "${proc_dir}/cwd" 2>/dev/null || echo "(permission denied)")"
  echo "  PID ${pid}"
  echo "    name: ${comm}"
  echo "    cmd:  ${cmd}"
  echo "    cwd:  ${cwd}"
  local looks_like_deopt=0
  if [[ "$cwd" == "${FRONTEND_ROOT}"* ]]; then
    looks_like_deopt=1
  elif [[ "$cmd" == *"deopt-v2-frontend"* ]]; then
    looks_like_deopt=1
  elif [[ ( "$comm" == "next-server" || "$comm" == "node" ) && "$cmd" == *"next"* && "$cwd" == *"deopt-v2-frontend"* ]]; then
    looks_like_deopt=1
  fi
  if [[ "$looks_like_deopt" == "1" ]]; then
    echo "    match: appears to be a DeOpt frontend process"
  else
    echo "    match: NOT recognised as a DeOpt frontend process — will NOT auto-kill"
  fi
}

report_port() {
  # Return 0 when the port is free, 1 when it is occupied.
  local port="$1"
  if ! port_has_listener "$port"; then
    echo "Port ${port}: free"
    return 0
  fi
  echo "Port ${port}: occupied by"
  local pids
  pids="$(port_pids "$port")"
  if [[ -z "$pids" ]]; then
    echo "  (unable to identify owner via /proc — likely owned by another user or a container)"
  else
    while IFS= read -r pid; do
      describe_pid "$pid"
    done <<< "$pids"
  fi
  return 1
}

echo "== DeOpt frontend port preflight =="
echo "Repo:           ${FRONTEND_ROOT}"
echo "Default port:   ${DEFAULT_PORT}"
echo "Fallback port:  ${FALLBACK_PORT}"
echo "Port 3010:      belongs to another project — not part of DeOpt's set"
echo

DEFAULT_OK=0
FALLBACK_OK=0
if report_port "$DEFAULT_PORT"; then
  DEFAULT_OK=1
fi
echo
if report_port "$FALLBACK_PORT"; then
  FALLBACK_OK=1
fi
echo

CHOSEN=""
if [[ "$DEFAULT_OK" == "1" ]]; then
  CHOSEN="$DEFAULT_PORT"
  echo "Both slots decision: port ${DEFAULT_PORT} is free — starting there."
elif [[ "$FALLBACK_OK" == "1" ]]; then
  CHOSEN="$FALLBACK_PORT"
  echo "Both slots decision: port ${DEFAULT_PORT} is occupied but ${FALLBACK_PORT} is free."
  echo "Starting on ${FALLBACK_PORT} — the frontend will be reachable at"
  echo "  http://localhost:${FALLBACK_PORT}"
  echo "instead of the usual http://localhost:${DEFAULT_PORT}."
else
  cat >&2 <<EOF

ERROR: both port ${DEFAULT_PORT} and port ${FALLBACK_PORT} are occupied.
DeOpt only launches on ${DEFAULT_PORT} or ${FALLBACK_PORT}. Free one
of them before retrying — this script will NOT auto-kill an
unrelated process, and it will NOT jump to port 3010 (which is
reserved for a different project).

To stop a listed DeOpt frontend process yourself, run:
  kill <PID>
See the PIDs, commands and working directories above.
EOF
  exit 1
fi

echo
echo "Starting: PORT=${CHOSEN} npm run dev"
if [[ "$DRY_RUN" == "1" ]]; then
  echo "(dry-run: DEOPT_LOCAL_FRONTEND_DRY_RUN=1 — not invoking npm)"
  exit 0
fi
cd "$FRONTEND_ROOT"
exec env PORT="${CHOSEN}" npm run dev
