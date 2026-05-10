# /check-state — verify what's connected/configured BEFORE asking

> *Solves the Twilio-keys forgetfulness problem at the source.*
> *Run BEFORE asking the user about credentials, integrations, migrations, or deploys.*

---

## When to run this

If you (Claude) are about to ask the user any of these:
- "Do you have X configured?"
- "Can you give me the [credential/key/secret/token]?"
- "Has migration N been applied?"
- "Is the [vendor] account set up?"
- "Are the deploys working?"
- "Have we shipped X yet?"

**STOP. Run /check-state first.** Most answers are already documented.

---

## What this skill does

Reads `docs/STATE.md` and:

1. Echoes the connected systems table (status, where credentials live, notes)
2. Echoes the migrations-applied table (per environment)
3. Echoes the deployed-surfaces table (last verified READY timestamps)
4. Echoes vendors NOT yet connected (with phase + blocker per vendor)
5. Echoes active spawned tasks
6. Echoes smoke-test status (verified vs substrate-only vs not-built)

If the answer to your question is HERE, don't ask the user. If it's NOT here, you may ask, AND you must update STATE.md in the same commit when you get the answer.

---

## How to invoke

```bash
bun run .claude/skills/check-state/check.ts
# Or via the Skill tool: /check-state
```

Optional argument: `--query "twilio"` to filter to a specific system.

---

## After running

You should be able to answer the question that prompted you to consider asking. If not, the gap is in STATE.md — fix it as part of your work.

---

## Update discipline

When the user tells you something STATE.md doesn't capture, update it in your CURRENT commit. Don't promise to "remember it for next time" — that's the failure mode. The fix is to write it down.
