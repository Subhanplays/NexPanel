#!/usr/bin/env bash
# =============================================================================
# NexPanel - Restart Script
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Stopping NexPanel..."
bash "${SCRIPT_DIR}/stop.sh"

echo "Waiting 2 seconds..."
sleep 2

echo "Starting NexPanel..."
bash "${SCRIPT_DIR}/start.sh"
