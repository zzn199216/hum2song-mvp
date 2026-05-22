#!/usr/bin/env bash
# Validate a Studio release directory before symlink cutover.
# Usage: validate_studio_release.sh [/path/to/release]
set -euo pipefail

RELEASE="${1:-$(readlink -f /root/hum2song-studio 2>/dev/null || true)}"
if [[ -z "${RELEASE}" || ! -d "${RELEASE}" ]]; then
  echo "[FAIL] Release path missing or not a directory: ${RELEASE:-<empty>}" >&2
  exit 1
fi

fail=0
pass() { echo "[PASS] $*"; }
warn() { echo "[WARN] $*"; }
fail_msg() { echo "[FAIL] $*"; fail=1; }

if [[ -x "${RELEASE}/venv/bin/uvicorn" ]]; then
  pass "venv/bin/uvicorn exists"
elif [[ -x "${RELEASE}/venv/bin/python" || -x "${RELEASE}/venv/bin/python3" ]]; then
  pass "venv python exists (uvicorn path may differ)"
else
  fail_msg "venv missing or not executable under ${RELEASE}/venv"
fi

SF2="${RELEASE}/assets/piano.sf2"
if [[ -e "${SF2}" ]]; then
  pass "assets/piano.sf2 present ($(readlink -f "${SF2}" 2>/dev/null || echo "${SF2}"))"
else
  SYSTEM_SF2="/usr/share/sounds/sf2/FluidR3_GM.sf2"
  if [[ -f "${SYSTEM_SF2}" ]]; then
    warn "assets/piano.sf2 missing; create symlink: ln -sfn ${SYSTEM_SF2} ${SF2}"
    fail_msg "assets/piano.sf2 missing (system SoundFont available at ${SYSTEM_SF2})"
  else
    fail_msg "assets/piano.sf2 missing and no system FluidR3_GM.sf2 found"
  fi
fi

if command -v curl >/dev/null 2>&1; then
  PORT="${STUDIO_HEALTH_PORT:-8000}"
  if curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" >/tmp/h2s_studio_health.json 2>/dev/null; then
    if grep -q '"soundfont_exists"[[:space:]]*:[[:space:]]*true' /tmp/h2s_studio_health.json; then
      pass "local /api/v1/health soundfont_exists=true"
    else
      warn "local health reachable but soundfont_exists is not true (service may point elsewhere)"
    fi
  else
    warn "skip live health check (service not on 127.0.0.1:${PORT})"
  fi
fi

exit "${fail}"
