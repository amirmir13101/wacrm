# AI Chatbot Removal and Knowledge Base Dependency Map

Date: 2026-08-30
Repository: `D:\Projects\wacrm-production-dev`
Baseline commit: `73b930f626d57d0a73d5c8b605bfa922098ea1df`

## Safety conclusion

The visible AI Chatbot is not the same subsystem as the working AI Agent. The current AI Chatbot uses the `rag_*` database family, `/api/rag/*`, and `src/lib/rag/*`. The working AI Agent uses the `ai_agent_*` database family, `/api/ai/*`, and `src/lib/ai/*`.

The `rag_*` family is mixed-purpose. Its provider, auto-reply, chatbot settings, and conversation controls are Chatbot-only, but its knowledge, embeddings, Firecrawl, website-import, schedules, import history, knowledge gaps, and historical question logs are reusable Knowledge Base data. Therefore, no `rag_*` object may be removed solely because of its prefix.

## Live runtime path

```text
Meta WhatsApp webhook
  -> deterministic flows / automations
  -> legacy RAG Chatbot auto-reply (to remove)
  -> working AI Agent dispatcher (preserve)
     -> ai_agent_configs
     -> conversation context
     -> ai_agent_knowledge_chunks
     -> provider generation
     -> messages.ai_generated / handoff controls
```

Target runtime path:

```text
Meta WhatsApp webhook
  -> deterministic flows / automations
  -> working AI Agent dispatcher
     -> existing AI Agent Knowledge
     + standalone Knowledge Base
     -> one bounded combined context
     -> provider generation using ai_agent_configs
```

## Chatbot-only components

- Dashboard route: `src/app/(dashboard)/ai-chatbot/page.tsx`.
- Sidebar/header route labels for `/ai-chatbot`.
- Dashboard test-chat UI and `/api/rag/chat`.
- Legacy provider configuration UI and `/api/rag/provider*`.
- Legacy WhatsApp auto-reply settings and `/api/rag/auto-reply`.
- Legacy chatbot instructions and `/api/rag/chatbot-settings`.
- Legacy RAG conversation pause/handoff API and `/api/rag/conversation-controls/*`.
- Legacy RAG webhook dispatch in `src/app/api/whatsapp/webhook/route.ts`.
- Chatbot answer-generation, memory, auto-reply, and conversation-control services in `src/lib/rag/`.

These can be removed only after the Knowledge Base routes and Agent retrieval path are in place.

## AI-Agent-only components

- Dashboard route: `src/app/(dashboard)/agents/page.tsx`.
- API routes under `src/app/api/ai/`.
- Runtime services under `src/lib/ai/`.
- Provider and embedding configuration in `ai_agent_configs`.
- Existing manual Agent knowledge in `ai_agent_knowledge_documents` and `ai_agent_knowledge_chunks`.
- Usage history in `ai_agent_usage_log`.
- Inbox draft action, `AiThreadBanner`, Take over, Resume AI, handoff summary, and `messages.ai_generated` indicator.
- WhatsApp webhook call to `dispatchInboundToAiReply`.

These are preserved and remain the source of truth for Agent configuration and live responses.

## Shared or reusable Knowledge Base components

- `rag_knowledge_sources`, `rag_knowledge_chunks`, and `rag_embeddings`.
- Firecrawl configuration and credit checks in `rag_firecrawl_settings`.
- Website import jobs/pages, import history, and scrape schedules.
- Knowledge gaps and historical answered-question records.
- Knowledge cleaning, chunking, storage, website import, and Firecrawl services in `src/lib/rag/`.
- Generic OpenAI-compatible provider helpers currently reused by the secondary `src/lib/ai-agent/store.ts` compatibility layer.

These components will be presented under `/knowledge-base` and their AI processing will use the existing AI Agent configuration. Firecrawl keeps its own crawl credential because it is not an LLM credential.

## Inbox controls classification

| Control | Owner | Action |
| --- | --- | --- |
| Draft with AI Agent | AI Agent | Preserve |
| AI-generated message indicator | AI Agent | Preserve |
| Take over | AI Agent | Preserve |
| Resume AI | AI Agent | Preserve |
| Agent handoff summary/banner | AI Agent | Preserve |
| AI Pause from `rag_conversation_controls` | AI Chatbot | Remove |
| Human request/accept status from `rag_conversation_controls` | AI Chatbot | Remove after confirming Agent controls cover the workflow |

## Configuration ownership

- Chat generation: `ai_agent_configs.api_key`.
- Embeddings: `ai_agent_configs.embeddings_api_key`.
- Firecrawl crawling: `rag_firecrawl_settings.encrypted_api_key`.
- Legacy `rag_provider_settings`: obsolete after guarded migration; never used as a second active AI configuration.

## Compatibility constraints

- Existing Agent responses must continue when the standalone Knowledge Base is empty or unavailable.
- Existing `ai_agent_knowledge_*` ingestion and retrieval must remain unchanged as the first source.
- Standalone Knowledge Base retrieval is best-effort and bounded; an error cannot break draft or auto-reply.
- The query embedding must be generated at most once per request and reused across both stores.
- Existing compatible standalone Knowledge Base embeddings are retained; no bulk re-embedding is performed automatically.
- Legacy provider secrets are never printed, returned to the browser, or committed.
