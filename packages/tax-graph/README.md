# @docket/tax-graph

Knowledge layer types + citation formatters + retrieval interface.

## What this package is

The substrate that grounds every agent answer in a citable authority.
Per the CEO plan (5/2/2026 — Section §5 of CLAUDE.md), Docket is built
as four (now five) layers: Knowledge, Data, Agent, Orchestration,
Governance. This package is the type-side and helper-side of the
Knowledge layer.

The DB tables (`authorities`, `authority_chunks`) live in `@docket/db`
because that's where every Drizzle schema lives. This package owns:

- **Types** — `Authority`, `AuthorityChunk`, plus the conceptual entities
  (`TaxConcept`, `WorkflowObject`, `FactPattern`, `DecisionRule`,
  `PlanningStrategy`) that don't have DB tables yet but get added when
  the first agent needs them.
- **Citation formatters** — turn an `Authority` (with effective date,
  optional supersession) + an optional chunk's `sectionPath` into the
  display string a preparer recognizes.
- **`KnowledgeRetriever` interface** — the contract every retrieval
  implementation honors. Used by agent code so it can be written
  against the interface before content + embeddings ship.
- **`NullRetriever`** — returns `[]` for every query. Lets agent code
  compile + run end-to-end before the real retrieval lands. Replace
  with `PostgresRetriever` (BM25 + cosine + reranker per D12) when
  ingestion is wired.

## What this package is NOT

- Not the DB schema. That's `@docket/db`.
- Not the ingestion code. That ships separately when content lands
  (Phase 2 per CEO plan: IRS Pub 17 + FTB residency manual).
- Not the agent code. That lives in `services/workers/src/agents`
  and `services/orchestrator`, and consumes this package's types.
- Not the visual citation chip. That's `<Citation>` in `@docket/ui`
  (uses formatters from here under the hood).

## Effective-date contract

Every authority has an `effectiveDate` and may have a `supersededDate`.
Retrieval queries always filter by "in effect on tax year T" — never
cite outdated law. The citation formatter renders supersession status
inline so a preparer sees `IRS Pub 17 (2023) — superseded 2024-01-01`
at a glance.
