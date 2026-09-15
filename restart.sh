#!/usr/bin/env bash
# =============================================================================
# VPS Panel - Restart Script
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Stopping VPS Panel..."
bash "${SCRIPT_DIR}/stop.sh"

echo "Waiting 2 seconds..."
sleep 2

echo "Starting VPS Panel..."
bash "${SCRIPT_DIR}/start.sh"
