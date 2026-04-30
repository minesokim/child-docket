# Memory mirrors

These files mirror the auto-memory anchors at `C:\Users\minse\.claude\projects\C--Users-minse\memory\` so they travel with the repo. When working in this repo, the canonical context is **`/CLAUDE.md`** at the repo root — these files are the durable backstop.

## Index

- **[MEMORY.md](MEMORY.md)** — original auto-memory index
- **[project_docket_strategic_anchor.md](project_docket_strategic_anchor.md)** — master strategic synthesis
- **[project_docket_design_partner.md](project_docket_design_partner.md)** — Antonio at Vazant (CA EA on OLT + IRS Solutions + Xero)
- **[project_docket_tech_foundation.md](project_docket_tech_foundation.md)** — locked tech decisions, cost discipline
- **[project_docket_ai_layers.md](project_docket_ai_layers.md)** — six intelligence layers + trust escalation
- **[project_docket_competitive.md](project_docket_competitive.md)** — competitive positioning vs Accrual, Basis, K1x
- **[reference_docket_repo.md](reference_docket_repo.md)** — repo paths, design source location
- **feedback_*.md** — small but load-bearing user preferences (anti-AI-slop, no left borders, popup billing tab, sync popup ↔ full page)

## When this conflicts with CLAUDE.md

CLAUDE.md is canonical. These files are point-in-time mirrors and may lag. If you find a contradiction, trust CLAUDE.md and update the mirror.

## When the user updates auto-memory

Auto-memory updates happen in `~/.claude/projects/C--Users-minse/memory/`. They do NOT auto-sync to this repo. Manually mirror important changes here when you want them to travel with the codebase. Run:

```bash
cp ~/.claude/projects/C--Users-minse/memory/project_docket_*.md .claude/memory/
cp ~/.claude/projects/C--Users-minse/memory/feedback_*.md .claude/memory/
cp ~/.claude/projects/C--Users-minse/memory/reference_docket_*.md .claude/memory/
```
