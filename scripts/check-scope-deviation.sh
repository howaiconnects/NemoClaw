#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Checks whether a PR's total changed lines exceed ci/deviation-threshold.json.
# If the threshold is exceeded, exits non-zero unless the PR body contains a
# "Scope-justification:" git trailer.
#
# Usage: BASE_SHA=<sha> PR_BODY=<body> bash scripts/check-scope-deviation.sh
#
# Environment variables:
#   BASE_SHA   — base commit SHA of the PR (github.event.pull_request.base.sha)
#   PR_BODY    — full PR body text (github.event.pull_request.body)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
THRESHOLD_FILE="$REPO_ROOT/ci/deviation-threshold.json"

if [ ! -f "$THRESHOLD_FILE" ]; then
  echo "ERROR: Threshold file not found: $THRESHOLD_FILE"
  exit 1
fi

if [ -z "${BASE_SHA:-}" ]; then
  echo "ERROR: BASE_SHA environment variable is required."
  exit 1
fi

MAX_LINES=$(python3 -c "import json,sys; print(json.load(open('$THRESHOLD_FILE'))['max_lines'])")

CHANGED_LINES=$(git diff --stat "${BASE_SHA}...HEAD" | tail -1 | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo 0)
CHANGED_LINES=$((CHANGED_LINES + $(git diff --stat "${BASE_SHA}...HEAD" | tail -1 | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo 0)))

echo "=== Scope Deviation Check ==="
echo "Changed lines : $CHANGED_LINES"
echo "Threshold     : $MAX_LINES"
echo ""

if [ "$CHANGED_LINES" -le "$MAX_LINES" ]; then
  echo "OK: Change size is within threshold."
  exit 0
fi

echo "EXCEEDED: $CHANGED_LINES lines changed, threshold is $MAX_LINES."
echo ""

# Check for Scope-justification trailer in PR body (case-insensitive key match).
if echo "${PR_BODY:-}" | grep -qiE '^[[:space:]]*Scope-justification[[:space:]]*:'; then
  echo "OK: Scope-justification trailer found — deviation approved."
  exit 0
fi

echo "FAIL: PR exceeds the ${MAX_LINES}-line scope threshold."
echo ""
echo "Either reduce the scope of this PR, or add a trailer to the PR body:"
echo ""
echo "    Scope-justification: <one sentence explaining why this scope is necessary>"
echo ""
echo "Per CL-101: scope additions beyond 40%% require explicit justification."
exit 1
