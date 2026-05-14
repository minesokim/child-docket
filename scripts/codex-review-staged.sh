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
#   ./scripts/codex-review-staged.sh                # full output (verbose)
#   ./scripts/codex-review-staged.sh --summary-only # only findings + verdict
#   # ... read codex output, fix any issues, re-stage, re-run ...
#   git commit  # protocol-gate enforces Codex-Reviewed trailer
#
# --summary-only mode pipes codex output through a filter that strips
# tool-call traces, line-number source quotes, and intermediate
# "exec / succeeded in Xms" status lines. Keeps only the codex
# findings (lines matching `- [P1]`, `- [P2]`, `- [P3]`) and the
# closing summary paragraph. Cuts typical codex output from
# ~1500-3000 tokens to ~200-500 tokens — useful in /overnight or any
# token-budget-constrained workflow. Per docs/TOKEN-EFFICIENCY.md.
#
# Per AUTONOMOUS-DECISIONS [23] (and 2026-05-09 escalation): codex
# review is UNCONDITIONAL on every feat|fix commit. The protocol-gate
# enforces the trailer. This script is the canonical way to run it.

set -e

SUMMARY_ONLY=0
for arg in "$@"; do
  if [ "$arg" = "--summary-only" ] || [ "$arg" = "-s" ]; then
    SUMMARY_ONLY=1
  fi
done

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

if [ "$SUMMARY_ONLY" = "1" ]; then
  # Filter codex output to findings + verdict only. Cuts tokens 70-85%.
  #
  # Keep (signal):
  #   - Lines starting with "- [P1]", "- [P2]", "- [P3]" — findings
  #   - The first "codex" verdict block at the end (paragraph after
  #     the last "codex" marker; this is the human-readable summary)
  #
  # Drop (noise):
  #   - "exec <command>" tool-call traces
  #   - " succeeded in Xms:" status lines + their source-quote blocks
  #   - Line-number-prefixed source quotes (NNN: code)
  #   - Empty trailing lines
  codex review --uncommitted 2>&1 | awk '
    BEGIN { in_verdict = 0; verdict_seen = 0 }
    # Track when we enter the final codex verdict block
    /^codex$/ { in_verdict = 1; verdict_seen = 1; print; next }
    # Within verdict block: print everything until blank line + non-verdict content
    in_verdict == 1 {
      if (/^$/ && verdict_seen == 1 && NR > 1) {
        # Allow blank lines inside verdict block; verdict ends on next exec/succeeded
        print
        next
      }
      if (/^(exec|"C:|2026-|succeeded |[[:space:]]*[0-9]+:|tool: )/) {
        in_verdict = 0
        next
      }
      print
      next
    }
    # Always keep finding lines (priority-tagged)
    /^- \[P[1-3]\]/ { print; next }
    # Drop everything else (tool traces, status lines, source quotes)
  '
else
  codex review --uncommitted
fi
