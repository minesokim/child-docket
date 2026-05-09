#!/usr/bin/env bash
# scripts/codex-review-staged.sh
#
# Run codex review on the currently-staged diff. Returns 0 if codex
# completed (success). Operator decides PASS / PASS-with-fixes-applied
# based on the output and adds the Codex-Reviewed trailer to the
# commit message accordingly.
#
# Usage:
#   git add <files>
#   ./scripts/codex-review-staged.sh
#   # ... read codex output, fix any issues, re-stage, re-run ...
#   git commit  # protocol-gate enforces Codex-Reviewed trailer
#
# Per AUTONOMOUS-DECISIONS [23] (and 2026-05-09 escalation): codex
# review is UNCONDITIONAL on every feat|fix commit. The protocol-gate
# enforces the trailer. This script is the canonical way to run it.

set -e

# Empty index is a hard failure. Codex flagged that exit 0 here lets
# the operator run this wrapper before `git add` (or after a stash
# that emptied the index), get a zero exit, and write `Codex-Reviewed:
# PASS` while codex actually reviewed nothing. The trailer is just
# text — the gate trusts the wrapper's exit code as the attestation.
# Empty index → exit 1 so the workflow fails loudly.
if git diff --cached --quiet; then
  echo "[codex-review-staged] BLOCKED: nothing staged. Run \`git add <files>\` first."
  echo "  The Codex-Reviewed trailer attests that codex reviewed the staged diff."
  echo "  Reviewing an empty diff would be a false attestation."
  exit 1
fi

# Worktree-cleanliness check. codex review --uncommitted scans
# staged + unstaged + untracked. If the operator has unrelated WIP,
# the trailer attestation no longer reflects only the commit being
# made — codex may report findings on files that aren't in the
# staged index. Fail-fast with stash instructions.
#
# Allowlist: paths that are NEVER code AND that codex won't read for
# review (binary build outputs, dependency dirs, editor swap files).
# We deliberately do NOT allowlist test-results/ — Playwright drops
# text artifacts there (.md, .json) that codex review --uncommitted
# scans, breaking the staged-only attestation. The operator either
# rms test-results/ or stashes it before review.
ALLOWLIST_REGEX='^(node_modules/|\.next/|\.turbo/|dist/|.*\.swp$|.*\.log$)'

UNSTAGED=$(git diff --name-only | grep -v -E "$ALLOWLIST_REGEX" || true)
UNTRACKED=$(git ls-files --others --exclude-standard | grep -v -E "$ALLOWLIST_REGEX" || true)

if [ -n "$UNSTAGED" ] || [ -n "$UNTRACKED" ]; then
  echo "[codex-review-staged] BLOCKED: worktree has changes outside the staged index."
  echo "  codex review --uncommitted scans staged + unstaged + untracked, so the review"
  echo "  would reflect more than the commit you're making. Stash or commit them first."
  echo ""
  if [ -n "$UNSTAGED" ]; then
    echo "  Unstaged tracked files:"
    echo "$UNSTAGED" | sed 's/^/    /'
  fi
  if [ -n "$UNTRACKED" ]; then
    echo "  Untracked files:"
    echo "$UNTRACKED" | sed 's/^/    /'
  fi
  echo ""
  echo "  To proceed (preserving the staged index):"
  echo "    git stash push -u --keep-index -m 'pre-codex-review'"
  echo "    bash scripts/codex-review-staged.sh"
  echo "    git stash pop"
  echo ""
  echo "  --keep-index is critical: a plain \`git stash push -u\` stashes the"
  echo "  staged index TOO, leaving the rerun with nothing to review."
  exit 1
fi

# --uncommitted reviews staged+unstaged+untracked. With the worktree
# clean (verified above), this reduces to staged-only.
#
# codex review CLI 0.120 doesn't accept a custom prompt with
# --uncommitted; it uses its default review heuristics which already
# cover security / correctness / race-conditions / edge-cases.
codex review --uncommitted
