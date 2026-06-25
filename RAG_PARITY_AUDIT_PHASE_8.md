# RAG Parity Audit Phase 8

Project: `D:\Projects\wacrm-production-dev`  
Branch: `production-ready-bulk-system`  
CRM commit audited: `4fe1678`  
Original starter audited: `G:\ai-sdk-rag-starter-main\ai-sdk-rag-starter-main`  
Audit date: 2026-06-26  
Deployment: skipped intentionally

## Executive summary

The new CRM RAG module preserves the important behavior of the working local RAG starter closely enough for the current rebuild stage.

The strongest parity matches are:

- same chunk size: 1,000 characters;
- same max chunks per source: 160;
- same sentence/paragraph splitting style;
- same extra `"supports"` feature chunk behavior;
- same embedding flow shape: chunk content embeddings plus question embedding;
- same vector search style: cosine similarity, threshold `0.5`, top `4`;
- same simple grounded answer principle: answer only from retrieved knowledge and fallback cleanly when unavailable.

The main intentional CRM differences are production-safety additions:

- workspace scoping;
- Supabase RLS and permission checks;
- BYOK provider settings;
- encrypted API key storage;
- Firecrawl settings separated from provider settings;
- source/chunk/embedding/chat-log tables in the `rag_*` namespace;
- authenticated dashboard APIs;
- dashboard-only chat path, with WhatsApp intentionally untouched.

No small code fix was needed during this audit. The only material limitation found is that live answer testing could not be performed against saved CRM knowledge because the connected Supabase project currently has zero RAG knowledge sources, zero chunks, and zero embeddings. Provider settings are present and enabled; Firecrawl settings are not configured.

## Scope and protected areas

Audited:

- knowledge adding;
- chunking;
- embedding;
- storage;
- retrieval;
- prompt;
- answer behavior;
- UI/API/security boundaries.

Not touched:

- WhatsApp webhook;
- WhatsApp auto-reply;
- payment;
- auth;
- contacts;
- inbox;
- broadcasts;
- checkout;
- production VPS deployment.

## Local starter architecture

The local starter uses:

- Drizzle + direct PostgreSQL connection;
- `resources` table for raw knowledge;
- `embeddings` table with `vector(1536)`;
- HNSW cosine index;
- `generateEmbeddings(content)` for chunking and embedding;
- `findRelevantContent(question)` for vector search;
- threshold `similarity > 0.5`;
- top `4` matches;
- chat route with a `getInformation` tool that retrieves relevant chunks before answering.

Relevant starter files:

- `G:\ai-sdk-rag-starter-main\ai-sdk-rag-starter-main\lib\ai\embedding.ts`
- `G:\ai-sdk-rag-starter-main\ai-sdk-rag-starter-main\lib\ai\provider.ts`
- `G:\ai-sdk-rag-starter-main\ai-sdk-rag-starter-main\lib\resources.ts`
- `G:\ai-sdk-rag-starter-main\ai-sdk-rag-starter-main\lib\db\schema\resources.ts`
- `G:\ai-sdk-rag-starter-main\ai-sdk-rag-starter-main\lib\db\schema\embeddings.ts`
- `G:\ai-sdk-rag-starter-main\ai-sdk-rag-starter-main\app\api\chat\route.ts`
- `G:\ai-sdk-rag-starter-main\ai-sdk-rag-starter-main\app\api\resources\route.ts`

## CRM RAG architecture

The CRM uses:

- Supabase client + Supabase RPC for pgvector retrieval;
- `rag_provider_settings`;
- `rag_firecrawl_settings`;
- `rag_knowledge_sources`;
- `rag_knowledge_chunks`;
- `rag_embeddings`;
- `rag_chat_logs`;
- `match_rag_knowledge_chunks(...)` RPC;
- encrypted BYOK provider key storage;
- workspace-scoped RLS and permission checks;
- dashboard-only chat API;
- manual and website knowledge import paths;
- Firecrawl scrape path for website import;
- no WhatsApp auto-reply connection yet.

Relevant CRM files:

- `D:\Projects\wacrm-production-dev\src\lib\rag\chunking.ts`
- `D:\Projects\wacrm-production-dev\src\lib\rag\embeddings.ts`
- `D:\Projects\wacrm-production-dev\src\lib\rag\knowledge.ts`
- `D:\Projects\wacrm-production-dev\src\lib\rag\knowledge-store.ts`
- `D:\Projects\wacrm-production-dev\src\lib\rag\embedding-store.ts`
- `D:\Projects\wacrm-production-dev\src\lib\rag\chat.ts`
- `D:\Projects\wacrm-production-dev\src\lib\rag\retrieval.ts`
- `D:\Projects\wacrm-production-dev\src\lib\rag\provider.ts`
- `D:\Projects\wacrm-production-dev\src\lib\rag\settings.ts`
- `D:\Projects\wacrm-production-dev\src\lib\rag\website-import.ts`
- `D:\Projects\wacrm-production-dev\src\app\api\rag\chat\route.ts`
- `D:\Projects\wacrm-production-dev\src\app\api\rag\knowledge\route.ts`
- `D:\Projects\wacrm-production-dev\src\app\api\rag\knowledge\[id]\embed\route.ts`
- `D:\Projects\wacrm-production-dev\src\app\api\rag\provider\route.ts`
- `D:\Projects\wacrm-production-dev\src\app\api\rag\firecrawl\route.ts`
- `D:\Projects\wacrm-production-dev\src\app\api\rag\website-import\route.ts`
- `D:\Projects\wacrm-production-dev\supabase\migrations\048_rag_foundation.sql`

## Functional parity table

| Area | Local starter | CRM RAG | Parity result |
|---|---|---|---|
| Knowledge source | `resources.content` | `rag_knowledge_sources.raw_content/cleaned_content` | Equivalent, CRM adds metadata/workspace |
| Manual knowledge add | `/api/resources` | `/api/rag/knowledge` | Equivalent purpose, CRM adds auth/permissions |
| Website import | Not primary in audited starter files | `/api/rag/website-import` with Firecrawl | CRM extension, not a regression |
| Character limit | No explicit same CRM UI limit found in starter | 200,000 chars | CRM product requirement, acceptable |
| Chunk length | 1,000 chars | 1,000 chars | Match |
| Max chunks | 160 | 160 | Match |
| Split method | newline or sentence-ending whitespace | newline or sentence-ending whitespace | Match |
| Long chunk split | 1,000-char slices | 1,000-char slices | Match |
| Feature chunks | extra `"supports"` chunks | extra `"supports"` chunks | Match |
| Embedding model | provider-configured embedding model | BYOK provider-configured embedding model | Equivalent, CRM is workspace-scoped |
| Query embedding | newline-normalized question | newline-normalized question | Match |
| Vector dimensions | 1536 | 1536 | Match |
| Vector index | HNSW cosine | HNSW cosine | Match by migration |
| Retrieval threshold | `> 0.5` | `>= 0.5` | Tiny difference; practically negligible |
| Match count | top 4 | top 4 | Match |
| Retrieval filtering | all local resources | active, non-deleted, same workspace, permissioned sources | Intentional CRM safety |
| Answer style | tool-call retrieval then answer from returned info | server retrieval then answer from snippets | Functionally equivalent for dashboard Q&A |
| Fallback | unavailable in knowledge base | `I do not see that information in the current knowledge base.` | Equivalent and cleaner |
| Security | local-only | RLS, auth, permissions, encrypted keys | CRM improvement |
| WhatsApp | not relevant | not connected yet | Correct for current phase |

## Chunking comparison

The exact Phase 8 sample knowledge was tested through the starter-compatible chunking behavior:

```text
VPS Wagon support email is [support@vpswagon.com](mailto:support@vpswagon.com).
VPS Wagon WhatsApp number is +44 7478 060494.
Singapore VPS location is available. Test IP is 45.38.210.3.
VPS x4 monthly price is $20.
VPS x4 yearly price is $200.
VPS Wagon does not sell laptops.
```

Result:

- input length: 277 characters;
- starter expected chunks: 1;
- CRM expected chunks: 1;
- chunk text: identical;
- no extra `"supports"` chunks, because the sample does not contain a `"supports"` list.

The single produced chunk is:

```text
VPS Wagon support email is [support@vpswagon.com](mailto:support@vpswagon.com). VPS Wagon WhatsApp number is +44 7478 060494. Singapore VPS location is available. Test IP is 45.38.210.3. VPS x4 monthly price is $20. VPS x4 yearly price is $200. VPS Wagon does not sell laptops.
```

Conclusion: chunking parity is strong.

## Embedding comparison

Starter:

- embeds each generated chunk sequentially using AI SDK `embed`;
- embeds user query with newline normalization;
- stores embedding with the chunk content.

CRM:

- embeds each generated chunk sequentially using AI SDK `embed`;
- embeds user query with newline normalization;
- stores embeddings separately in `rag_embeddings`;
- records embedding status and errors;
- marks failed embedding rows safely without exposing secrets;
- requires 1536 dimensions.

Conclusion: embedding behavior is equivalent, with CRM production safety around status, workspace, and encrypted provider settings.

## Retrieval comparison

Starter retrieval:

```ts
similarity = 1 - cosineDistance(embeddings.embedding, userQueryEmbedded)
where similarity > 0.5
order by similarity desc
limit 4
```

CRM retrieval:

```sql
1 - (e.embedding <=> p_query_embedding)
similarity >= 0.5
order by similarity desc
limit 4
```

CRM also filters:

- same workspace;
- user has `view_rag_chatbot`;
- embedding status is `ready`;
- chunk not deleted;
- source not deleted;
- source status is `active`.

The only minor mathematical difference is `>` in the starter versus `>=` in CRM. This only matters for an exact similarity value of `0.5`, which is rare and not worth a migration at this phase.

RPC verification:

- `match_rag_knowledge_chunks(...)` exists;
- test call with a zero vector returned safely with zero rows.

Conclusion: retrieval parity is strong and production scoping is correct.

## Prompt and answer behavior comparison

Starter system behavior:

- lightweight knowledge-base chatbot;
- use `getInformation` before answering;
- answer only from tool-returned knowledge;
- if no relevant information is returned, say the information is not available in the knowledge base;
- do not guess.

CRM system behavior:

- helpful business support assistant;
- answer only from provided knowledge;
- do not use outside knowledge;
- do not guess;
- if missing, return `I do not see that information in the current knowledge base.`;
- answer in the same language as the question if possible;
- do not show raw chunk IDs, source headers, prompts, debug JSON, provider JSON, or API keys.

Conclusion: CRM keeps the simple RAG prompt style and adds useful multilingual and no-leak instructions. This is acceptable and safer for production.

## Exact test questions

Live answer testing was not performed because the connected Supabase project currently has:

- `rag_knowledge_sources`: 0;
- `rag_knowledge_chunks`: 0;
- `rag_embeddings`: 0.

The table below shows expected behavior if the supplied Phase 8 test knowledge is saved and embedded.

| # | Question | Expected CRM RAG answer from supplied knowledge | Live result |
|---:|---|---|---|
| 1 | What is the support email? | `support@vpswagon.com` | Not run: no saved RAG knowledge |
| 2 | What is the WhatsApp number? | `+44 7478 060494` | Not run: no saved RAG knowledge |
| 3 | Do you have a Singapore VPS location? | Yes, Singapore VPS location is available. Test IP: `45.38.210.3`. | Not run: no saved RAG knowledge |
| 4 | What is the Singapore test IP? | `45.38.210.3` | Not run: no saved RAG knowledge |
| 5 | What is the monthly price of VPS x4? | `$20` | Not run: no saved RAG knowledge |
| 6 | What is the yearly price of VPS x4? | `$200` | Not run: no saved RAG knowledge |
| 7 | Do you sell laptops? | No. The knowledge says VPS Wagon does not sell laptops. | Not run: no saved RAG knowledge |
| 8 | Do you sell domains? | `I do not see that information in the current knowledge base.` | Not run: no saved RAG knowledge |
| 9 | Answer in Urdu: What is the support email? | Urdu response containing `support@vpswagon.com` | Not run: no saved RAG knowledge |
| 10 | How can I contact you? | Contact via support email and WhatsApp number, because both exist in knowledge. | Not run: no saved RAG knowledge |

## Supabase and environment verification

Safe checks performed without printing secrets:

- CRM `.env.local` exists with Supabase/service/encryption/site key names.
- Starter `.env.local` was not found.
- RAG provider settings rows: 1.
- RAG provider configured: yes.
- RAG provider enabled: yes.
- RAG provider type present: OpenRouter.
- RAG provider last test status: success.
- Firecrawl settings rows: 0.
- Firecrawl configured: no.
- RAG knowledge sources: 0.
- RAG chunks: 0.
- RAG embeddings: 0.
- RAG chat logs: 0.
- old `ai_*` tables checked through row select return `PGRST205`, meaning they are not present in the exposed schema cache.

Migration/code verification:

- `vector` extension is created by migration.
- `rag_embeddings.embedding` is `vector(1536)`.
- HNSW cosine index is declared as `idx_rag_embeddings_vector_hnsw`.
- `match_rag_knowledge_chunks(...)` exists and returns safely.
- RLS is enabled in the migration for all new `rag_*` tables.
- every `rag_*` table has `workspace_id`.
- old `ai_*` permission names are not reintroduced in the Phase 1 tests.

## UI/API/security comparison

CRM adds necessary production layers that the starter does not have:

- dashboard route permission checks;
- API permission checks;
- `view_rag_chatbot`, `manage_rag_chatbot`, and `manage_rag_provider`;
- encrypted provider API key storage;
- masked key display only;
- workspace-scoped settings and knowledge;
- no raw encrypted keys returned from API routes;
- safe provider error sanitization;
- dashboard chat logs without secrets;
- no WhatsApp webhook integration yet.

This is a correct divergence from the local starter because the starter is single-user/local, while the CRM is multi-workspace.

## Matches

- Chunking method matches.
- Embedding generation flow matches.
- Query embedding normalization matches.
- Vector search method matches.
- Match count matches.
- Similarity threshold effectively matches.
- Simple grounded prompt style is preserved.
- Clean fallback behavior is preserved.
- The CRM avoids old over-complicated AI chatbot concepts.
- WhatsApp is untouched.

## Differences

Intentional and acceptable:

- Supabase RPC replaces Drizzle/direct Postgres.
- Workspace/RLS/auth filters are added.
- Source status/deleted filters are added.
- Provider and Firecrawl settings are BYOK and encrypted.
- CRM answer path retrieves first, then calls the model, instead of using a model tool call to retrieve.
- CRM adds multilingual instruction.
- CRM logs safe chat metadata.

Minor parity difference:

- Starter uses `similarity > 0.5`; CRM uses `similarity >= 0.5`.
- Recommendation: keep for now. Only change later if a real answer-quality issue appears.

Current operational gap:

- No saved CRM RAG knowledge exists yet, so dashboard answer parity cannot be live-tested until a test source is added and embedded.

## Risks

1. Live answer quality remains unproven until the exact Phase 8 test knowledge is added and embedded.
2. OpenRouter embedding behavior may differ from the starter if the starter used a different provider/model.
3. Since Firecrawl is not configured, website import cannot be end-to-end tested yet.
4. The CRM route uses non-streaming `generateText`, while the starter streams. This should not reduce answer quality, but UI behavior is different.
5. The RPC uses permission-aware retrieval. This is correct, but any workspace-permission misconfiguration would cause empty retrieval even when chunks exist.

## Recommended fixes or next steps

No code fix is recommended from this audit.

Recommended next local step:

1. Add the exact Phase 8 test knowledge through the CRM dashboard.
2. Embed the source.
3. Run the 10 Phase 8 test questions through the dashboard UI.
4. Compare with the local starter using the same provider/model if possible.
5. If results differ, compare:
   - retrieved chunk count;
   - similarity scores;
   - provider/model;
   - prompt;
   - whether workspace permissions filtered chunks.

Optional later cleanup:

- If strict starter parity is desired, change RPC threshold from `>=` to `>`. This would require a migration because the SQL function is already applied. It is not recommended unless a real issue appears.

## Conclusion

The CRM RAG rebuild is architecturally aligned with the local RAG starter. The important answer-quality mechanics are preserved: starter-style chunking, embeddings, cosine vector retrieval, top-4 matching, 0.5 threshold, and simple grounded answer generation.

The CRM safely adds the production pieces that the local starter does not need: workspace scoping, RLS, encrypted BYOK provider settings, authenticated dashboard APIs, and safe logging.

Phase 8 should be considered code-level parity passed, with live answer parity still pending because there is currently no saved and embedded CRM RAG knowledge to query.

No deployment was performed.
WhatsApp was not touched.
