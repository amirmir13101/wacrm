# CRM RAG AI SDK Guide Audit

Date: 2026-06-26  
Project: `D:\Projects\wacrm-production-dev`  
Branch: `production-ready-bulk-system`  
Baseline commit inspected: `709cd43`

## 1. Executive summary

The current CRM RAG implementation mostly matches the core architecture from the official AI SDK RAG Chatbot guide:

- store business knowledge as source records;
- split knowledge into chunks;
- generate embeddings for chunks;
- store embeddings in PostgreSQL/Supabase with `pgvector`;
- retrieve relevant chunks by embedding similarity;
- pass retrieved context to the model;
- answer only from knowledge and fall back when information is missing.

However, the CRM is not an exact implementation of the official guide or the local starter behavior. It has a more customized server-side retrieval pipeline, extra query expansion, keyword search, workspace scoping, encrypted BYOK provider settings, Firecrawl import, dashboard UI, and optional WhatsApp auto-reply settings.

The biggest answer-quality risks found are:

1. The CRM does not use the AI SDK `getInformation` tool-call pattern from the guide. It performs retrieval before calling the model. This is valid, but different from the starter and can behave differently on short or multi-part questions.
2. Chunking has no overlap and a hard default cap of 160 chunks per source. With the current 500,000 character knowledge limit, that cap can leave large parts of a source unembedded and unretrievable.
3. Retrieval uses hybrid keyword + vector expansion. This can be stronger than the basic guide, but it also means ranking behavior can differ from the starter.
4. The prompt is much more complex than the official guide. It is safer, but it may make the assistant conservative if the retrieved snippets are incomplete.
5. Local live-answer verification was limited because the local environment did not expose production RAG knowledge data. No production deployment was performed.

Clear conclusion:

**CRM RAG mostly matches the official AI SDK RAG guide at the database/vector architecture level, but it still needs answer-quality fixes before it can be treated as equivalent to the local starter RAG behavior.**

## 2. Official AI SDK RAG guide requirements

The official AI SDK RAG Chatbot guide describes this core flow:

1. Save source knowledge as resource data.
2. Split source content into smaller chunks.
3. Generate embeddings for each chunk.
4. Store chunks and embeddings in Postgres with `pgvector`.
5. Use OpenAI `text-embedding-3-small` with 1536-dimensional vectors in the guide example.
6. Create a cosine vector index, commonly HNSW.
7. For a user question, embed the question.
8. Retrieve the most similar chunks by cosine similarity.
9. Use a similarity threshold, with the guide example using `0.5`.
10. Return a small number of matching chunks, with the guide example using top 4.
11. Pass retrieved information to the model as context/tool result.
12. Instruct the model to answer only from retrieved context and say the information is unavailable when it is not present.

The guide’s starter-style architecture uses an AI SDK tool, commonly named like `getInformation`, so the model can call the retrieval tool and then answer from the returned information.

## 3. Current CRM RAG architecture

Current CRM RAG files inspected:

- `D:\Projects\wacrm-production-dev\src\lib\rag\chunking.ts`
- `D:\Projects\wacrm-production-dev\src\lib\rag\knowledge.ts`
- `D:\Projects\wacrm-production-dev\src\lib\rag\knowledge-store.ts`
- `D:\Projects\wacrm-production-dev\src\lib\rag\embeddings.ts`
- `D:\Projects\wacrm-production-dev\src\lib\rag\embedding-store.ts`
- `D:\Projects\wacrm-production-dev\src\lib\rag\provider.ts`
- `D:\Projects\wacrm-production-dev\src\lib\rag\chat.ts`
- `D:\Projects\wacrm-production-dev\src\lib\rag\website-import.ts`
- `D:\Projects\wacrm-production-dev\src\app\api\rag\chat\route.ts`
- `D:\Projects\wacrm-production-dev\src\app\api\rag\knowledge\route.ts`
- `D:\Projects\wacrm-production-dev\src\app\api\rag\website-import\route.ts`
- `D:\Projects\wacrm-production-dev\src\app\(dashboard)\ai-chatbot\page.tsx`
- `D:\Projects\wacrm-production-dev\supabase\migrations\048_rag_foundation.sql`
- `D:\Projects\wacrm-production-dev\supabase\migrations\049_rag_auto_reply_settings.sql`

Current CRM RAG data model:

- `rag_provider_settings`
- `rag_firecrawl_settings`
- `rag_knowledge_sources`
- `rag_knowledge_chunks`
- `rag_embeddings`
- `rag_chat_logs`
- `rag_auto_reply_settings`

Current answer flow:

1. Dashboard posts the user question to `/api/rag/chat`.
2. The API checks workspace permission with `requireRagPermission('view_rag_chatbot')`.
3. `answerRagDashboardQuestion` loads the workspace provider settings.
4. The system optionally rewrites recent conversational follow-up questions into standalone questions.
5. The system creates deterministic retrieval query variants.
6. It runs keyword retrieval and vector retrieval.
7. It combines and deduplicates candidate chunks.
8. It sends selected snippets to the model with a strict RAG prompt.
9. It logs the answer to `rag_chat_logs`.

## 4. What matches the official guide

The CRM matches the guide in these important ways:

### Source storage

The CRM stores uploaded/manual/imported knowledge in `rag_knowledge_sources`. This is equivalent to the guide’s resource storage concept.

### Chunking

The CRM chunks source content into `rag_knowledge_chunks`.

Relevant implementation:

- `createRagChunks(...)` in `src/lib/rag/chunking.ts`
- `prepareRagKnowledgeSource(...)` in `src/lib/rag/knowledge.ts`

### Embeddings

The CRM generates embeddings for chunks using AI SDK `embed(...)`.

Relevant implementation:

- `generateRagEmbedding(...)` in `src/lib/rag/embeddings.ts`
- `embedRagManualKnowledgeSource(...)` in `src/lib/rag/embedding-store.ts`

### pgvector storage

The CRM stores embeddings in `rag_embeddings.embedding vector(1536)`.

Relevant migration:

- `supabase/migrations/048_rag_foundation.sql`

### HNSW cosine index

The CRM creates an HNSW index with cosine operators:

- `USING hnsw (embedding vector_cosine_ops)`

This matches the guide’s expected pgvector setup.

### Similarity RPC

The CRM defines `public.match_rag_knowledge_chunks(...)`, which:

- takes `p_query_embedding vector(1536)`;
- filters workspace-scoped active sources;
- filters ready embeddings;
- calculates cosine similarity using `1 - (embedding <=> query_embedding)`;
- accepts a similarity threshold;
- accepts a match count.

This is very close to the guide’s vector retrieval approach.

### Threshold and top-k defaults

The CRM RPC and retrieval call use the same basic values as the guide:

- similarity threshold: `0.5`
- vector match count: `4`

### Grounded answer prompt

The CRM prompt instructs the model to answer only from the provided knowledge snippets and to fallback when the information is not available.

This matches the guide’s grounding principle.

## 5. What does not match the official guide

### No AI SDK retrieval tool call in the main dashboard path

The guide’s starter pattern uses a tool-call flow, commonly:

```text
model receives user question
model calls getInformation tool
tool retrieves relevant chunks
model answers from returned tool information
```

The CRM currently uses:

```text
server receives question
server creates retrieval queries
server retrieves chunks
server sends snippets to model
model answers
```

This is not wrong, but it is not identical to the guide or local starter behavior.

Risk:

- The model cannot decide to call retrieval more than once in the same turn.
- Multi-part questions depend on the CRM’s deterministic query expansion.
- Short questions depend on CRM query expansion instead of the model turning short input into a fuller tool question.

### Chunking is not the same as the starter guide

The CRM uses sentence/newline splitting and packs chunks up to 1000 characters, but there is no overlap.

Current default:

```ts
maxChunkLength: 1000
maxChunksPerSource: 160
```

Risk:

- Facts near chunk boundaries can be separated.
- Pricing blocks, contact blocks, and FAQ blocks can be split in ways that weaken retrieval.
- For a 500,000 character source, 160 chunks of around 1000 characters means only around 160,000 characters can be indexed before the cap is reached.

This is the most important architecture risk found in the audit.

### The CRM adds keyword retrieval and query expansion

The official guide is a simpler vector RAG example. The CRM adds:

- keyword chunk search;
- query variants;
- contact-specific variants;
- location-specific variants;
- pricing-specific variants;
- short-topic expansions.

This can improve results, but it also means the CRM is not a pure guide clone.

### The prompt is more complex

The CRM system prompt has detailed business-support rules for:

- short topic questions;
- pricing/numeric questions;
- contact questions;
- location/IP questions;
- language matching;
- avoiding debug text.

This is safer than the minimal guide prompt, but it can be more conservative when the retrieved context is incomplete.

### The CRM uses BYOK provider settings

The guide usually assumes a configured server-side provider. The CRM stores encrypted workspace provider keys in `rag_provider_settings`.

This is correct for the CRM product model, but it introduces extra failure modes:

- missing key;
- failed decrypt;
- unsupported provider;
- invalid embedding model;
- provider quota/billing error.

### Website import is CRM-specific

The guide is not a Firecrawl website importer. The CRM imports website content through Firecrawl, stores it as knowledge, chunks it, then embeds it.

This is a product feature beyond the guide.

## 6. Chunking comparison

### Official guide / starter principle

The official RAG guide expects source text to be split into retrievable chunks. The exact chunking in the guide is intentionally simple, because the guide is focused on the RAG pattern.

### Current CRM behavior

Current CRM chunking:

- cleans content;
- splits by newline or sentence punctuation;
- packs sentences/paragraphs until the chunk reaches about 1000 characters;
- creates extra “feature” chunks for some comma-separated support/service style text;
- caps each source at 160 chunks.

### Matching parts

- The CRM does chunk before embedding.
- Chunk size around 1000 characters is reasonable.
- Chunks are stored separately from source records.

### Differences and risks

The 160 chunk cap is not aligned with the 500,000 character knowledge limit. If a source is large, later content may be saved in `rag_knowledge_sources.content` but never represented in `rag_knowledge_chunks` or embeddings.

This can directly cause wrong answers:

- the knowledge exists in the source;
- the user sees it in the dashboard;
- but retrieval cannot find it because no chunk/embedding exists for that part.

Recommended fix:

- Make the chunk cap adaptive to the knowledge character limit, or remove the cap and replace it with a safer operational limit.
- Add chunk overlap.
- Preserve FAQ, pricing, contact, policy, table-like, and heading sections as coherent chunks where possible.

## 7. Embedding comparison

### Official guide

The guide uses OpenAI embedding models such as `text-embedding-3-small`, producing 1536-dimensional vectors.

### Current CRM

The CRM defaults are:

- OpenAI embedding model: `text-embedding-3-small`
- OpenRouter embedding model: `openai/text-embedding-3-small`
- embedding dimensions: `1536`

The CRM stores vectors in:

- `rag_embeddings.embedding vector(1536)`

### Matching parts

- Uses AI SDK `embed`.
- Uses 1536-dimensional vectors.
- Stores embeddings in pgvector.
- Tracks embedding model, dimensions, status, and errors.
- Filters retrieval to `embedding_status = 'ready'`.

### Differences and risks

The CRM supports workspace BYOK providers. That is product-correct but adds operational risk. If the encrypted key cannot be decrypted, or if the provider does not support embeddings, retrieval will fail even though the database schema is correct.

Local diagnostic limitation:

- The local environment available during this audit did not show production RAG sources.
- A previous local diagnostic in this thread showed provider decrypt/provider errors when trying to run answer generation locally.
- Because secrets must not be printed, this audit only reports the safe category: provider/local environment verification was incomplete.

Recommended fix:

- Add a safe provider diagnostic that reports only:
  - provider configured yes/no;
  - decrypt available yes/no;
  - embedding model configured yes/no;
  - embedding test pass/fail;
  - ready/pending/failed embedding counts.
- Never print API keys.

## 8. Retrieval comparison

### Official guide

The guide flow is:

1. Embed the user question.
2. Query pgvector for the closest chunks.
3. Use threshold `0.5`.
4. Use top 4.
5. Return chunks to the model through a tool result.

### Current CRM

The CRM flow is:

1. Optionally rewrite follow-up question to standalone form.
2. Build deterministic query variants.
3. Run keyword retrieval.
4. Generate embeddings for query variants.
5. Run vector retrieval through RPC.
6. Deduplicate chunks.
7. Sort by similarity.
8. Send top snippets to the model.

### Matching parts

- Uses query embeddings.
- Uses pgvector cosine similarity.
- Uses active published workspace knowledge only.
- Uses threshold `0.5`.
- Uses top 4 per vector query.

### Differences and risks

The CRM is broader than the guide, because one user question can become multiple retrieval queries. This is useful for multi-part questions such as:

```text
12 gb vps price monthly and yearly
```

But the model itself is not calling `getInformation` multiple times like the starter. Instead, deterministic code creates query variants.

Risk:

- If query expansion misses the right variant, the model does not get the right context.
- If keyword retrieval ranks noisy chunks too high, unrelated snippets may be included.
- If the important chunk was never created due to the 160 chunk cap, neither keyword nor vector retrieval can find it.

## 9. Prompt and answer comparison

### Official guide prompt style

The guide uses a simple grounded instruction:

- answer from retrieved information;
- do not use outside knowledge;
- say information is unavailable if it is not present.

### Current CRM prompt style

The CRM prompt is stricter and more business-specific in behavior, but still generic across business types. It includes rules for:

- short topic questions;
- pricing;
- contact information;
- location/IP;
- avoiding raw debug/context text;
- returning the same language as the customer.

### Matching parts

- The model is told to answer only from knowledge.
- The model is told not to invent facts.
- The model has a clean fallback.

### Differences and risks

The CRM prompt may be more conservative than the starter. If retrieval snippets are weak, the model may say the information is not present even when the full source contains it elsewhere.

This is not primarily a prompt bug. It is usually a context-selection problem:

```text
bad or incomplete retrieved snippets → model cannot answer → fallback
```

Recommended fix:

- Improve chunk coverage first.
- Then compare the CRM prompt against the starter prompt.
- Keep the CRM prompt simple enough that it does not over-filter useful evidence.

## 10. Multi-part question behavior

The official starter-style flow lets the model call retrieval tools with rewritten questions. For example, a multi-part user question can lead to multiple tool calls:

```text
getInformation("12 gb vps price monthly")
getInformation("12 gb vps price yearly")
```

The CRM attempts to approximate this with deterministic query expansion:

- original question;
- split `and` parts;
- monthly/yearly variants;
- contact variants;
- location variants;
- short-topic expansion variants.

This is a good direction, but it is not identical to model-driven tool calling.

Current risk:

- For simple short questions like `vps`, `hosting`, or `whatsapp`, the starter may ask a better tool question than the CRM’s deterministic expansion.
- For multi-part questions, the CRM may retrieve enough context, but the 160 chunk cap can still remove the needed source from the index.

Recommended fix:

- Keep deterministic expansion, but add test coverage against the starter-style expected behavior.
- Consider adding a true AI SDK tool-call mode later if exact starter parity remains required.
- Do not hard-code business terms like VPS, hosting, or WhatsApp.

## 11. Supabase vs Drizzle/Postgres conclusion

Supabase is not the root problem by itself.

The official guide and local starter use PostgreSQL with pgvector. Supabase is also PostgreSQL with pgvector. The CRM migration correctly creates:

- `vector` extension;
- `vector(1536)` column;
- HNSW cosine index;
- vector similarity RPC.

Therefore, the CRM does not need Drizzle just to match RAG quality.

The more important quality factors are:

1. whether all important content is chunked;
2. whether embeddings are generated successfully;
3. whether query expansion retrieves the right chunks;
4. whether the prompt receives enough context;
5. whether the provider/model behaves consistently.

Supabase client + RPC remains a safe architecture for the CRM because it fits workspace auth, permissions, and RLS.

## 12. Current risks causing wrong answers

Ranked by severity:

### P0 — Chunk cap can hide saved knowledge from retrieval

`RAG_KNOWLEDGE_CHARACTER_LIMIT` is 500,000, but `maxChunksPerSource` defaults to 160.

At roughly 1000 characters per chunk, a large source can save far more text than the embedding layer indexes.

This can make the system say:

```text
I do not see that information in the current knowledge base.
```

even when the information is visibly present in the saved source.

### P0 — Local verification cannot prove production answer behavior

The local environment used during this audit did not contain production RAG sources. That means the exact provided production questions could not be honestly re-tested from local code against the real active workspace.

This must be solved before claiming parity.

### P1 — No overlap between chunks

No overlap means a plan name, price, phone number label, or location label can be separated from the value.

### P1 — Tool-call behavior differs from starter

The starter’s model can choose retrieval calls. CRM retrieval is precomputed. This can cause different behavior for short or broad user questions.

### P1 — Very short answer budget

The CRM uses `maxOutputTokens: 160` for answers. This may be too small for broad or multi-part answers such as “list all plans with monthly and yearly prices.”

### P2 — Keyword retrieval can help or hurt

Keyword retrieval improves exact fact lookup, but if scoring is too broad, it can include unrelated snippets.

### P2 — Provider compatibility

OpenRouter/OpenAI-compatible provider behavior must be tested with the exact production model and embeddings model. The schema is correct, but provider behavior can still vary.

## 13. Required test questions

The user requested these comparison questions:

1. `What is the support email?`
2. `Do you have Singapore VPS location?`
3. `What is the Singapore test IP?`
4. `What is the monthly price of VPS x4?`
5. `What is the yearly price of VPS x4?`
6. `Do you sell laptops?`
7. `Whatsapp support available?`
8. `vps`
9. `hosting`
10. `pakistani ip location vps available`

### Local test status

Local testing was limited:

- The local environment did not return production RAG knowledge sources.
- No production secrets were printed.
- No production data was changed.
- No VPS deployment was performed.

Because of this limitation, this audit cannot honestly claim that the current CRM answers match the starter for those 10 questions.

Required next test before deployment/use:

- Run the same 10 questions through the authenticated CRM dashboard against the active production workspace.
- Capture safe debug metadata:
  - generated retrieval queries;
  - selected source IDs/titles;
  - chunk IDs;
  - match type;
  - similarity score;
  - final fallback reason;
  - provider error category if any.
- Do not expose API keys, tokens, or full private source dumps.

## 14. Recommended fixes ranked by priority

### Priority 1 — Make chunk coverage match the 500,000 character limit

Change the chunking/indexing strategy so saved knowledge is actually searchable.

Recommended approach:

- Remove or raise the fixed 160 chunk cap.
- Make the cap adaptive based on source length and operational budget.
- Add overlap, for example 100–200 characters or one sentence of overlap.
- Add tests proving a 500,000 character source has late-source facts embedded and retrievable.

### Priority 2 — Add safe retrieval debug output

Add a dashboard-only debug view for `/api/rag/chat` showing:

- query variants;
- keyword candidates;
- vector candidates;
- source title;
- chunk index;
- similarity score;
- final selected snippets;
- fallback reason;
- provider error category.

Never show:

- API keys;
- encrypted secrets;
- auth/session tokens;
- full private knowledge dumps.

### Priority 3 — Compare against starter behavior with fixture parity tests

Use the same sample knowledge and same questions in:

- local starter;
- CRM RAG unit/integration tests.

The CRM should be considered aligned only when retrieved chunks and final answers are close enough.

### Priority 4 — Consider true AI SDK tool-call mode

If exact starter behavior is still required, add an optional dashboard/starter-compatible answer mode:

- model receives the user question;
- model can call a `getInformation` tool;
- tool runs CRM vector retrieval;
- model answers from tool output.

This should be generic and workspace-scoped. Do not re-add the previously removed separate Starter RAG tab.

### Priority 5 — Increase answer token budget for broad questions

Raise the final answer token limit from 160 to a safer range for list/comparison answers.

This should be tested to avoid overly long WhatsApp replies.

### Priority 6 — Keep Supabase RPC, do not switch database layer just for parity

Drizzle is not required for answer quality. The CRM’s Supabase pgvector foundation is structurally sound.

## 15. Final conclusion

The CRM RAG system is architecturally close to the official AI SDK RAG guide:

- PostgreSQL/Supabase pgvector is correct.
- `vector(1536)` is correct.
- HNSW cosine indexing is correct.
- Query embedding + similarity RPC is correct.
- Workspace-scoped source/chunk/embedding storage is correct.
- Manual and website knowledge embedding flow exists.

But the CRM should not yet be considered fully equivalent to the local starter RAG quality.

The most likely root cause of “knowledge exists but CRM says it does not” is not Supabase vs Postgres. It is the gap between:

```text
saved source content
```

and:

```text
chunked + embedded + retrievable content
```

The fixed 160 chunk cap is the strongest concrete risk found. The second major gap is that CRM uses pre-retrieval and deterministic query expansion instead of the guide’s model-driven tool-call flow.

Recommended next implementation phase:

1. Fix chunk coverage and overlap.
2. Add safe retrieval debug.
3. Run starter-vs-CRM fixture parity tests.
4. Only then consider adding true AI SDK tool-call retrieval mode if the CRM still diverges from the starter.

No code, database, deployment, or protected CRM features were changed as part of this audit report.
