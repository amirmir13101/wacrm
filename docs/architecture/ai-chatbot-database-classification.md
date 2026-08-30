# AI Chatbot Database Classification and Removal Guard

Date: 2026-08-30
Baseline commit: `73b930f626d57d0a73d5c8b605bfa922098ea1df`

## Current data inventory

Counts were read without exposing row contents or credentials.

| Object | Rows | Category | Decision |
| --- | ---: | --- | --- |
| `rag_provider_settings` | 2 | A — Chatbot only | Remove only after Agent-config guard passes |
| `rag_auto_reply_settings` | 1 | A — Chatbot only | Remove |
| `rag_chatbot_settings` | 1 | A — Chatbot only | Remove |
| `rag_conversation_controls` | 2 | A — Chatbot only | Remove after Agent inbox regression tests |
| `rag_firecrawl_settings` | 2 | C — Knowledge Base | Retain |
| `rag_knowledge_sources` | 1 | C — Knowledge Base | Retain |
| `rag_knowledge_chunks` | 160 | C — Knowledge Base | Retain |
| `rag_embeddings` | 160 | C — Knowledge Base | Retain |
| `rag_website_import_jobs` | 18 | C — Knowledge Base | Retain |
| `rag_website_import_pages` | 281 | C — Knowledge Base | Retain |
| `rag_scrape_schedules` | 0 | C — Knowledge Base | Retain |
| `rag_import_history` | 18 | C — Knowledge Base | Retain |
| `rag_knowledge_gaps` | 0 | C — Knowledge Base | Retain |
| `rag_chat_logs` | 320 | C — Knowledge Base activity | Retain as historical answered-question/retrieval activity |
| `ai_agent_configs` | 1 | B — AI Agent | Retain |
| `ai_agent_knowledge_documents` | 1 | B — AI Agent | Retain |
| `ai_agent_knowledge_chunks` | 430 | B — AI Agent | Retain |
| `ai_agent_usage_log` | 10 | B — AI Agent | Retain |

## Category A: eligible for guarded removal

### Tables

- `rag_provider_settings`
- `rag_auto_reply_settings`
- `rag_chatbot_settings`
- `rag_conversation_controls`

### Functions

- Chatbot-only service retrieval helper if no longer referenced after dual-source Agent retrieval is installed. Generic Knowledge Base match functions remain.

### Permissions

- `view_rag_chatbot`
- `manage_rag_chatbot`
- `manage_rag_provider`
- `enable_rag_auto_reply`

These keys are replaced by `view_knowledge_base` and `manage_knowledge_base`. Existing explicit member grants must be copied before the old keys are removed from application code.

## Category B: shared with or required by AI Agent

- `ai_agent_configs`
- `ai_agent_knowledge_documents`
- `ai_agent_knowledge_chunks`
- `ai_agent_usage_log`
- Agent semantic and lexical match functions
- `conversations.ai_autoreply_disabled`
- `conversations.ai_reply_count`
- `conversations.ai_handoff_summary`
- `messages.ai_generated`
- `claim_ai_reply_slot`

No Category B object may be dropped or renamed by the Chatbot-removal migration.

## Category C: retained for standalone Knowledge Base

- `rag_firecrawl_settings`
- `rag_knowledge_sources`
- `rag_knowledge_chunks`
- `rag_embeddings`
- `rag_website_import_jobs`
- `rag_website_import_pages`
- `rag_scrape_schedules`
- `rag_import_history`
- `rag_knowledge_gaps`
- `rag_chat_logs`
- Knowledge Base match functions and indexes

The `rag_` prefix denotes retrieval-augmented generation, not the removed Chatbot UI. Renaming these populated tables would add risk without improving behavior, so they remain physically named `rag_*` while all active user-facing and API naming becomes Knowledge Base.

## Provider migration guard

There are two legacy provider rows, but only one has a matching `ai_agent_configs` row. Both legacy rows use OpenRouter, while the working Agent supports OpenAI or Anthropic and uses a separate OpenAI-compatible embeddings key.

The destructive migration must therefore:

1. Never overwrite an existing Agent configuration.
2. Refuse to drop `rag_provider_settings` if a legacy workspace lacks an Agent configuration.
3. Require that workspace to configure the AI Agent first, rather than silently converting an unsupported provider or exposing/re-encrypting a secret.
4. Drop the legacy table only when every legacy workspace has an Agent configuration.

## Removal order

1. Add Knowledge Base permissions and copy explicit legacy grants.
2. Change RLS policies and match functions to Knowledge Base permissions.
3. Deploy Knowledge Base UI/API and Agent dual-source retrieval.
4. Verify Agent-only, Knowledge-Base-only, combined, and no-result retrieval.
5. Remove Chatbot webhook dispatch and inbox controls.
6. Confirm every legacy provider workspace has an Agent configuration.
7. Apply the separately reviewed destructive migration.

No migration in this refactor may reset the database or delete Category B/C rows.
