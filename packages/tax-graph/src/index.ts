// @docket/tax-graph — knowledge layer types + helpers.
//
// What lives here:
//   - Domain types for the tax-graph ontology
//   - Citation formatters (effective-date + supersession aware)
//   - KnowledgeRetriever interface + NullRetriever
//   - Position Library v0 (20 hand-curated, Antonio-reviewed entries
//     spanning Tier 1-4 of the Position Framework). Discovery Agent +
//     Position Agent consume.
//
// What does NOT live here:
//   - DB tables (those are @docket/db)
//   - UI components (Citation chip is in @docket/ui)
//   - Ingestion code (separate workstream — Phase 2 of CEO plan)
//   - Agent code (services/workers + services/orchestrator)

export * from './types.js';
export * from './citations.js';
export * from './retrieval.js';
export * from './positions.js';
export * from './discovery-scan.js';
