# AI Chatbot Database Removal Plan

Date: 2026-08-30
Repository baseline: `73b930f626d57d0a73d5c8b605bfa922098ea1df`

## Status

Both migrations were applied successfully to the Supabase project on 2026-08-30:

1. `067_knowledge_base_and_ai_agent_retrieval.sql` — non-destructive prerequisite: **applied**.
2. `068_remove_obsolete_ai_chatbot.sql` — destructive, review-required cleanup: **applied after explicit approval**.

The preflight found two legacy provider rows and one cleanup blocker. After explicit approval, the single unsupported legacy provider record was permanently discarded. Migration 068 then passed its guard and completed transactionally without `CASCADE`.

Post-migration verification confirmed that all four Category-A tables are absent, both Knowledge Base retrieval functions are present, obsolete member/invitation permission keys are absent, and retained AI Agent, Firecrawl, Knowledge Base, embedding, activity, and website-import row counts remain intact.

## Data transformation performed by 067

- Copies explicit `view_rag_chatbot`, `manage_rag_chatbot`, and `manage_rag_provider` member/invitation grants into `view_knowledge_base` and `manage_knowledge_base`.
- Adds a generated `rag_knowledge_chunks.search_vector` column and `idx_rag_knowledge_chunks_search_vector` GIN index. Existing knowledge text is not rewritten.
- Creates bounded, workspace-scoped `match_knowledge_base_fts` and `match_knowledge_base_semantic` functions.
- Replaces RLS policies on retained Knowledge Base tables with the new Knowledge Base permissions.
- Does not drop, truncate, reset, re-embed, or move any knowledge record.

## Objects removed by 068

### Tables and current rows

| Table | Current rows | Reason |
| --- | ---: | --- |
| `rag_provider_settings` | 2 | Obsolete second Chatbot AI-provider configuration |
| `rag_auto_reply_settings` | 1 | Obsolete Chatbot auto-reply configuration |
| `rag_chatbot_settings` | 1 | Obsolete Chatbot tone/fallback configuration |
| `rag_conversation_controls` | 2 | Obsolete Chatbot pause/handoff state superseded by AI Agent controls |

Dropping these tables also removes only their table-owned primary keys, unique constraints, check constraints, RLS policies, update triggers, and indexes. Known secondary indexes removed with them are:

- `idx_rag_provider_settings_workspace`
- `idx_rag_auto_reply_settings_workspace`
- `idx_rag_conversation_controls_workspace`
- `idx_rag_conversation_controls_conversation`
- `idx_rag_conversation_controls_requested`

The removed foreign keys are the four `workspace_id -> workspaces(id)` keys and the `rag_conversation_controls.conversation_id -> conversations(id)` key. No foreign key on a retained table points to a removed table. Migration 068 intentionally does not use `CASCADE`; any unexpected external dependency aborts the transaction.

No standalone column is dropped from a retained table.

### Functions

- `match_rag_knowledge_chunks(uuid, vector(1536), integer, double precision)`
- `match_rag_knowledge_chunks_for_service(uuid, vector(1536), integer, double precision)`

They are replaced by the workspace-scoped Knowledge Base retrieval functions created in 067.

### Permission keys

- `view_rag_chatbot`
- `manage_rag_chatbot`
- `manage_rag_provider`
- `enable_rag_auto_reply`

These JSON keys are removed only after 067 has copied useful explicit grants to the new Knowledge Base keys.

## Objects retained unchanged

### AI Agent

- `ai_agent_configs` — 1 row
- `ai_agent_knowledge_documents` — 1 row
- `ai_agent_knowledge_chunks` — 430 rows
- `ai_agent_usage_log` — 10 rows
- `conversations.ai_autoreply_disabled`
- `conversations.ai_reply_count`
- `conversations.ai_handoff_summary`
- `messages.ai_generated`
- `claim_ai_reply_slot`
- AI Agent lexical and semantic matching functions

### Knowledge Base

- `rag_firecrawl_settings` — 2 rows
- `rag_knowledge_sources` — 1 row
- `rag_knowledge_chunks` — 160 rows
- `rag_embeddings` — 160 rows
- `rag_chat_logs` — 320 historical activity rows
- `rag_website_import_jobs` — 18 rows
- `rag_website_import_pages` — 281 rows
- `rag_import_history` — 18 rows
- `rag_scrape_schedules` — 0 rows
- `rag_knowledge_gaps` — 0 rows

The retained `rag_` prefix means retrieval-augmented generation at the storage layer; these tables are no longer exposed as an AI Chatbot feature.

## Required preflight and application order

1. Back up the production database using the existing Supabase backup procedure.
2. Apply 067 only.
3. Verify Knowledge Base permissions, CRUD, Firecrawl, website import, embedding, and Agent dual-source retrieval.
4. Confirm every `rag_provider_settings.workspace_id` has a matching `ai_agent_configs` row with an AI key. Do not print either key.
5. Review and apply 068 in one transaction. Its guard and lack of `CASCADE` make unexpected state fail closed.
6. Re-run Agent-only, Knowledge-Base-only, combined-source, no-result, inbox, and webhook regression tests.

## Rollback posture

- Before 068, rollback is application-only because 067 preserves all rows.
- After 068, table restoration requires the pre-migration database backup; no Category A data is copied because it is obsolete configuration/control state.
- Knowledge Base and AI Agent content remain available throughout and require no re-embedding.
