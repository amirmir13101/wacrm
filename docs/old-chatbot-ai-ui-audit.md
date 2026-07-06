# Old Chatbot AI UI Audit Report

## 1. Summary

This report audits the old removed Chatbot AI UI from git history, using the code immediately before the Phase A removal commit `63b26e0` (`63b26e0^`) as the main reference point.

The old Chatbot AI feature was removed because the answer/retrieval/question-answer logic had become too complex and unsafe. This audit is UI-focused only: it documents the old dashboard options, forms, buttons, settings, status cards, API dependencies, database references, permissions, and related flows. It does not recommend restoring the old answer/retrieval logic.

Important separation:

- Useful UI ideas may be reused in the new RAG AI Chatbot if they are simple and safe.
- Old answer/retrieval complexity should remain removed.
- Old `ai_*` tables and old chatbot backend logic should not be restored as part of this audit.
- This report is for understanding the previous UI and choosing which user-facing controls are worth rebuilding cleanly.

## 2. Files inspected

Main git reference inspected: `63b26e0^`.

Old dashboard UI:

- `src/app/(dashboard)/ai-chatbot/page.tsx`

Old AI Chatbot API routes:

- `src/app/api/ai-chatbot/route.ts`
- `src/app/api/ai-chatbot/provider/route.ts`
- `src/app/api/ai-chatbot/provider/embeddings/route.ts`
- `src/app/api/ai-chatbot/firecrawl/route.ts`
- `src/app/api/ai-chatbot/website-import/route.ts`
- `src/app/api/ai-chatbot/website-import/[id]/route.ts`
- `src/app/api/ai-chatbot/sources/[id]/route.ts`
- `src/app/api/ai-chatbot/test/route.ts`
- `src/app/api/ai-chatbot/gaps/route.ts`
- `src/app/api/ai-chatbot/rechunk/route.ts`
- `src/app/api/ai-chatbot/restructure/route.ts`
- `src/app/api/ai-chatbot/schedules/route.ts`
- `src/app/api/ai-chatbot/schedules/[id]/route.ts`
- `src/app/api/ai-chatbot/import-history/route.ts`
- `src/app/api/ai-chatbot/conversations/[id]/route.ts`
- `src/app/api/ai-chatbot/structured-offers/backfill/route.ts`

Old AI backend modules:

- `src/lib/ai/auto-reply.ts`
- `src/lib/ai/calculations.ts`
- `src/lib/ai/change-detection.ts`
- `src/lib/ai/chatbot.ts`
- `src/lib/ai/chunking.ts`
- `src/lib/ai/conversation-controls.ts`
- `src/lib/ai/embedding-backfill.ts`
- `src/lib/ai/embeddings.ts`
- `src/lib/ai/firecrawl.ts`
- `src/lib/ai/knowledge.ts`
- `src/lib/ai/knowledge-gaps.ts`
- `src/lib/ai/language.ts`
- `src/lib/ai/memory.ts`
- `src/lib/ai/provider.ts`
- `src/lib/ai/provider-errors.ts`
- `src/lib/ai/retrieval.ts`
- `src/lib/ai/scrape-schedules.ts`
- `src/lib/ai/structuring.ts`
- `src/lib/ai/translation.ts`
- `src/lib/ai/website-import.ts`

Old contact/inbox/sidebar integration:

- `src/components/layout/sidebar.tsx`
- `src/lib/team/permissions.ts`
- `src/hooks/use-workspace-permissions.ts`
- `src/components/contacts/contact-detail-view.tsx`
- `src/components/inbox/message-thread.tsx`
- `src/app/api/contacts/[id]/memory/route.ts`

Old database migrations inspected:

- `supabase/migrations/033_ai_chatbot.sql`
- `supabase/migrations/034_ai_chatbot_provider_settings.sql`
- `supabase/migrations/035_ai_chatbot_conversation_controls.sql`
- `supabase/migrations/036_ai_website_knowledge_imports.sql`
- `supabase/migrations/037_ai_firecrawl_settings.sql`
- `supabase/migrations/038_ai_hybrid_retrieval.sql`
- `supabase/migrations/039_ai_provider_embedding_settings.sql`
- `supabase/migrations/040_ai_knowledge_gaps.sql`
- `supabase/migrations/041_ai_scrape_schedules.sql`
- `supabase/migrations/042_ai_import_history.sql`
- `supabase/migrations/043_ai_language_settings.sql`
- `supabase/migrations/044_ai_contact_memory.sql`
- `supabase/migrations/045_ai_knowledge_structuring.sql`
- `supabase/migrations/046_ai_knowledge_gap_diagnostics.sql`

Current new RAG UI comparison file:

- `src/app/(dashboard)/ai-chatbot/page.tsx`

## 3. Old AI Chatbot dashboard structure

The old AI Chatbot dashboard was not implemented as multiple visual tabs inside the page. It was one long scrolling dashboard at `/ai-chatbot`, exposed in the sidebar as “AI Chatbot” when the user had `view_ai_chatbot`.

### Page header

Purpose:

- Introduced AI Chatbot setup, testing, and safe customer replies.
- Displayed a workspace plan state badge.

Visible text/purpose:

- Title: `AI Chatbot`
- Description: “Add workspace knowledge, test answers, and control safe AI replies for customer messages.”
- Plan badge:
  - `Active Pro: auto-reply available`
  - or `Draft mode only`

### Top status cards

Three status cards existed:

| Card | Purpose | Status/details |
| --- | --- | --- |
| Chatbot | Whether chatbot was enabled | `Enabled` / `Disabled`; active knowledge source count |
| Auto-reply | Whether live WhatsApp auto-reply was enabled | `On` / `Off`; plan access reason |
| AI provider | Whether provider API key was configured | `API key configured` / `API key missing`; provider and masked key/server default |

API route used:

- `GET /api/ai-chatbot`

Database tables touched through backend:

- `ai_chatbot_settings`
- `ai_knowledge_sources`
- `ai_chatbot_provider_settings`
- `ai_firecrawl_settings`

### Firecrawl Website Import settings section

Purpose:

- Stored and tested a BYOK Firecrawl API key for website crawling.

Fields shown:

- Firecrawl API key password input.
- Placeholder used masked key if configured.

Buttons/actions:

- `Save Key`
- `Test Connection`

Status indicators:

- `Connection working`
- `Key saved`
- `Key required`
- Remaining credits
- Plan credits
- Max concurrency
- Last test error if any

API routes used:

- `GET /api/ai-chatbot/firecrawl`
- `PUT /api/ai-chatbot/firecrawl`
- `POST /api/ai-chatbot/firecrawl`

Database tables:

- `ai_firecrawl_settings`

Notes:

- API keys were not returned to the browser except as masked values.
- This was connected to backend storage and Firecrawl account testing.

### AI Provider Settings section

Purpose:

- Stored workspace-owned AI provider credentials and optional embedding/structuring/memory settings.

Provider fields:

- Provider select:
  - OpenAI
  - OpenRouter
  - Groq
  - Ollama / OpenAI-compatible
  - Custom OpenAI-compatible API
  - Anthropic Claude (saved only)
- Model input.
- API key password input.
- Base URL input.

Semantic search embeddings fields:

- Embeddings enabled switch.
- Embedding model input.
- Dimensions number input.
- Embedding status/support message.
- Last embedding test error if any.

AI-enhanced knowledge structuring fields:

- Structuring enabled switch.
- Call cap/import number input.
- Note that highest-value pages were processed first and remaining pages used deterministic extraction.

Customer memory fields:

- Memory enabled switch.
- Summarize after AI replies number input.
- Memory retention select:
  - 30 days
  - 60 days
  - 90 days
  - 180 days
  - Forever
- Auto-clear on Human Needed switch.

Buttons/actions:

- `Test Connection`
- `Test Embeddings`
- `Save API Settings`

API routes used:

- `GET /api/ai-chatbot/provider`
- `PUT /api/ai-chatbot/provider`
- `POST /api/ai-chatbot/provider`
- `POST /api/ai-chatbot/provider/embeddings`

Database tables:

- `ai_chatbot_provider_settings`

Notes:

- Multilingual fields existed in the provider data shape/backend (`multilingual_enabled`, `default_response_language`, `supported_languages`, `translation_model`), but the old dashboard hard-coded those values on save and did not show a visible multilingual settings panel in this page.
- Anthropic was visible as a saveable provider but marked as not supported for Phase 1 live chat.

### Chatbot Instructions section

Purpose:

- Controlled high-level chatbot and WhatsApp auto-reply behavior.

Fields/settings:

- Chatbot enabled switch.
- Tone select:
  - Friendly
  - Professional
  - Concise
  - Supportive
- Handover enabled switch.
- Fallback message textarea.
- Handover message textarea.
- Live WhatsApp auto-reply switch.

Buttons/actions:

- `Save Settings`

Status/permission behavior:

- Auto-reply switch was disabled unless the workspace had plan access and `enable_ai_auto_reply`.
- If plan access was not available, the page showed a plan access warning.

API route used:

- `PUT /api/ai-chatbot`

Database tables:

- `ai_chatbot_settings`

### Business Knowledge manual entry section

Purpose:

- Added manual business knowledge sources.

Fields:

- Knowledge type select:
  - Business knowledge
  - FAQ
  - Instructions
  - Website import
- Title input.
- Knowledge content textarea.

Buttons/actions:

- `Save Knowledge`

Character limits:

- Manual knowledge: `100,000` characters.
- Imported website knowledge/draft: `200,000` characters.

API route used:

- `POST /api/ai-chatbot`

Database tables:

- `ai_knowledge_sources`
- `ai_knowledge_chunks`

### Test Chatbot section

Purpose:

- Sent a dashboard-only test question restricted to workspace knowledge.

Fields:

- Test question textarea.

Buttons/actions:

- `Ask Test Question`

Answer display:

- Status/reason line, for example `answered · reason`.
- Answer text.
- Answer panel color changed for answered vs fallback/warning.

Hidden debug UI:

- A large Retrieval Debug panel existed in source code, but it was disabled with `legacyDebugAnswer?.debug && false`.
- Because of `&& false`, this debug panel was not visible in the live old dashboard at `63b26e0^`.

Hidden debug fields in source:

- Query.
- Provider configured.
- Embeddings enabled.
- Chunk counts.
- Exact/keyword/vector/answer-bearing candidate counts.
- Embedding status counts.
- Run Backfill button.
- Fallback reason.
- Calculation result.
- Full-context fallback attempted/outcome/token budget/source titles.
- Detected intents.
- Terms.
- Selected evidence cards with IDs, source title, source URL, match types, scores, reasons, rerank reasons.

API route used:

- `POST /api/ai-chatbot/test`

Database tables/backend:

- `ai_chatbot_settings`
- `ai_knowledge_chunks`
- `ai_chatbot_logs`
- provider settings via backend helpers

### Import Website Knowledge section

Purpose:

- Imported public website content using the workspace Firecrawl account.
- Required review before publishing.

Fields:

- Website URL input.
- Page limit select:
  - 5 preview pages
  - 25 pages
  - 50 pages
  - 100 pages

Buttons/actions:

- `Import Website Knowledge`
- `Discard Draft`
- `Publish to Knowledge Base`

Status indicators:

- `Full Pro import`
- `Trial preview limit`
- Job status:
  - running
  - draft_ready
  - completed
  - failed
  - discarded
- `Draft ready — not live yet`
- `Published to chatbot`
- `Publish required`
- `Saved and searchable`

Summary metrics:

- Included in draft.
- Skipped/excluded.
- Failed.
- Duplicates.
- Credits used.
- Provider.
- AI structured pages.
- Grounded fields.

Page review list:

- Up to 30 checked pages displayed.
- Page title/canonical URL/original URL.
- Page status.
- Structuring source.
- Skip reason.

Draft editor:

- Draft title input.
- Draft content textarea.
- Explicit note that existing published knowledge remained unchanged until publish.

Quality warnings:

- Import quality warnings appeared in a yellow warning block.

API routes used:

- `GET /api/ai-chatbot/website-import`
- `POST /api/ai-chatbot/website-import`
- `GET /api/ai-chatbot/website-import/[id]`
- `PATCH /api/ai-chatbot/website-import/[id]`

Database tables:

- `ai_website_import_jobs`
- `ai_website_import_pages`
- `ai_import_history`
- `ai_knowledge_sources`
- `ai_knowledge_chunks`

### Schedule & History section

Purpose:

- Managed scheduled Firecrawl re-scrapes and reviewed import history.

Schedule form fields:

- Website URL.
- Frequency:
  - Daily
  - Weekly
  - Monthly
  - Manual only
- Page limit number input, min 1, max 200.
- Day of week select for weekly.
- Run hour (UTC) select.
- Auto-publish changes switch.

Buttons/actions:

- `Add Schedule`
- `Cancel`
- `Save Schedule`

Active schedule card actions:

- Delete/deactivate schedule button.
- `Edit`
- `Pause` / `Resume`
- `Require Review` / `Enable Auto-publish`

Active schedule details:

- URL.
- Frequency.
- Auto-publish/review badge.
- Active/paused badge.
- Next run.
- Last run.
- Last status.
- Last result page counts.

Warnings:

- Scheduler warning if active schedules looked stale:
  - “Scheduled imports are not running. Please check your server configuration.”

Import history table columns:

- Date.
- Website.
- Trigger.
- Status.
- Pages.
- Changes.
- Credits.
- Action.

Import history actions:

- `Review & Publish` for `draft_ready` rows.
- `Load More`.

API routes used:

- `GET /api/ai-chatbot/schedules`
- `POST /api/ai-chatbot/schedules`
- `PATCH /api/ai-chatbot/schedules/[id]`
- `DELETE /api/ai-chatbot/schedules/[id]`
- `GET /api/ai-chatbot/import-history`
- `GET /api/ai-chatbot/website-import/[id]`

Database tables:

- `ai_scrape_schedules`
- `ai_import_history`
- `ai_website_import_jobs`
- `ai_website_import_pages`

### AI Chatbot Testing Flow section

Purpose:

- Displayed a setup/testing roadmap.

Important:

- The section existed in source but was hidden with `state && false`.
- It was not visible in the old live UI at `63b26e0^`.

Roadmap steps in source:

1. Add AI provider API key
2. Save and test provider connection
3. Add or edit business knowledge
4. Ask a dashboard test question
5. Ask an unknown question and confirm fallback
6. Enable chatbot
7. Enable auto-reply if active Pro
8. Send WhatsApp test message
9. Confirm AI replies only once
10. Pause AI in Inbox and confirm it stops
11. Resume AI and confirm it replies again
12. Mark Needs Human and confirm AI stops

### Knowledge Preview section

Purpose:

- Listed saved knowledge sources and actions.

Displayed:

- Source type label.
- Title.
- Status badges:
  - `Published to chatbot`
  - `Archived`
  - `Saved and searchable`
- Content preview, line-clamped.

Actions:

- `Re-structure Draft` for website sources.
- Edit knowledge.
- Delete knowledge.

Hidden actions:

- Re-chunk single source button existed but was hidden with `false &&`.
- Re-chunk all sources button existed but was hidden with `state && false`.

API routes used:

- `PUT /api/ai-chatbot/sources/[id]`
- `DELETE /api/ai-chatbot/sources/[id]`
- `POST /api/ai-chatbot/restructure`
- Hidden:
  - `POST /api/ai-chatbot/rechunk`

Database tables:

- `ai_knowledge_sources`
- `ai_knowledge_chunks`
- `ai_website_import_jobs` for restructure draft flow
- `ai_website_import_pages` for restructure draft pages

### Unanswered Questions section

Purpose:

- Displayed grouped knowledge gaps from customer questions the chatbot could not answer.

Displayed:

- Customer question.
- Last asked timestamp.
- Channel.
- Reason: `missing_knowledge`.
- Asked count.
- Suggested admin note/action.
- Language distribution.

Actions:

- `Add to Knowledge Base`
- `View All`
- `Show Recent 20`

States:

- Knowledge gap tracking not enabled.
- No unanswered questions yet.
- List of grouped gaps.

API route used:

- `GET /api/ai-chatbot/gaps`

Database tables:

- `ai_knowledge_gaps`

### Edit Business Knowledge modal

Purpose:

- Edited existing saved knowledge source.

Fields:

- Knowledge type.
- Title.
- Knowledge content.

Buttons/actions:

- Cancel.
- `Update Knowledge`.

API route used:

- `PUT /api/ai-chatbot/sources/[id]`

Database tables:

- `ai_knowledge_sources`
- `ai_knowledge_chunks`

## 4. Old Knowledge Base UI

### Add manual knowledge options

The old UI supported adding manual knowledge directly from the dashboard:

- Knowledge type:
  - Business knowledge
  - FAQ
  - Instructions
  - Website import
- Title.
- Content.
- Save Knowledge.

Backend behavior:

- Created a knowledge source.
- Split content into chunks.
- Inserted chunk records.

### Edit knowledge options

The Knowledge Preview list opened an Edit Business Knowledge modal.

Editable:

- Source type.
- Title.
- Content.

After save:

- Source updated.
- Chunks refreshed.

### Archive/delete options

The old UI exposed a delete button. Source code and API used `DELETE /api/ai-chatbot/sources/[id]`.

The source status model supported `active` and `archived`, and the preview displayed `Archived` if present, but the dashboard action seen in the old source was delete, not a visible archive/unarchive toggle.

### Source list display

The Knowledge Preview list displayed:

- Type label.
- Title.
- Status badges.
- Short content preview.
- Action buttons.

### Source detail display

There was no separate source-detail page. The dashboard list plus edit modal were the source UI. Website import/restructure drafts used the website import draft review panel.

### Prepare/embed options

The old dashboard had embedding settings and test/backfill support. However:

- Test Embeddings was visible in AI Provider Settings.
- A Run Backfill button existed inside a hidden Retrieval Debug block.
- Re-chunk buttons existed but were hidden in the Knowledge Preview section.
- There was no always-visible “Prepare for Chatbot” button like the current new RAG UI has.

### Chunk/embedding status shown

Visible:

- Provider embeddings enabled/model/dimensions/settings/test.

Hidden:

- Embedding status counts and pending warning inside disabled Retrieval Debug panel.

### Website import options

Covered in section 5 below.

### File/document import

No PDF/file/document import UI was found in the old AI Chatbot dashboard at `63b26e0^`.

### Character limits

From `src/lib/ai/website-import.ts` at `63b26e0^`:

- `MAX_MANUAL_KNOWLEDGE_CONTENT_LENGTH = 100_000`
- `MAX_IMPORTED_WEBSITE_KNOWLEDGE_CONTENT_LENGTH = 200_000`
- `MAX_WEBSITE_DRAFT_CONTENT_LENGTH = 200_000`

### Import history

The old dashboard had a visible Import History table inside Schedule & History.

### Import errors/warnings

The old website import panel showed:

- Job error message.
- Import quality warnings.
- Page skip reasons.
- Failed page counts.
- Skipped/excluded counts.

### Review/edit before publishing flow

The old website import flow did not publish immediately. It created a draft with:

- Draft title.
- Draft content.
- Discard Draft.
- Publish to Knowledge Base.

Existing published knowledge remained unchanged until publish.

## 5. Old Website Import UI

### Website URL input

Visible in Import Website Knowledge:

- `Website URL`
- Placeholder: `https://example.com`

### Firecrawl API key requirement

The import button was disabled unless:

- User could manage AI Chatbot.
- Import was not already running.
- URL was non-empty.
- Firecrawl API key was configured.

### Import button

Button:

- `Import Website Knowledge`

### Import status/progress

Displayed:

- Running spinner.
- “Firecrawl is processing this website.”
- Processed/discovered page count.
- Draft-ready/completed/failed status.

### Sitemap/crawl options

The UI stated that Firecrawl handled:

- Sitemap discovery.
- JavaScript rendering.
- Proxy selection.
- Caching.
- Robots rules.
- Crawl concurrency.

The UI itself exposed only URL and page limit, not deep crawl strategy switches.

### Page discovery behavior shown in UI

The UI showed:

- Pages found/imported/skipped/failed.
- Pages checked list.
- Page canonical URLs.
- Skip reasons.
- Duplicate page count.

### Imported/skipped/failed page reporting

Yes:

- Included in draft.
- Skipped/excluded.
- Failed.
- Duplicates.
- Page status badges.
- Skip reasons.

### Draft/review flow

Yes:

- Draft title.
- Draft content.
- Discard Draft.
- Publish to Knowledge Base.
- Explicit warning that draft was not live until publish.

### Source preview/editor

Website draft editor was part of the import result panel.

After publishing, the source appeared in Knowledge Preview.

### Firecrawl test button

Yes:

- Firecrawl Website Import settings had `Test Connection`.

### Crawl limit/page limit controls

Visible page limit select:

- 5 preview pages.
- 25 pages.
- 50 pages.
- 100 pages.

Scheduled scrape page limit:

- Numeric input, 1 to 200.

Backend max page limit at this point:

- `MAX_PAGE_LIMIT = 100` in `src/lib/ai/website-import.ts`.

### UI warnings

Visible warnings included:

- Trial preview limit warning.
- Import quality warnings.
- Job error message.
- Page skip reasons.
- Scheduler warning for stale scheduled imports.

## 6. Old Provider Settings UI

### OpenAI/API provider settings

Supported provider select values:

- OpenAI
- OpenRouter
- Groq
- Ollama / OpenAI-compatible
- Custom OpenAI-compatible API
- Anthropic Claude (saved only)

Fields:

- Provider.
- Model.
- API key.
- Base URL.

### Model selection

Model was a free text input, not a fixed dropdown.

Default choices in UI logic:

- OpenAI: `gpt-4o-mini`
- OpenRouter: `openai/gpt-4o-mini`
- Groq: `llama-3.1-8b-instant`
- Ollama: `llama3.1`
- Custom: `gpt-4o-mini`
- Anthropic: `claude-3-5-haiku-latest`

### API key input/masking

API key field was a password input.

If a key was already saved, UI showed masked value and said:

- “Saved key: [masked]. Leave blank to keep it.”
- “Your key is encrypted on the server and never returned to the browser.”

### Test provider button

Yes:

- `Test Connection`.

### Firecrawl settings

Separate Firecrawl Website Import settings section:

- Firecrawl API key.
- Save Key.
- Test Connection.
- Credits/concurrency status.

### Save/test/reset buttons

Visible:

- Save API Settings.
- Test Connection.
- Test Embeddings.
- Firecrawl Save Key.
- Firecrawl Test Connection.

No explicit reset/clear API key button was found in the old dashboard source.

### Per-workspace provider settings

Yes. Provider settings were workspace-scoped through:

- `ai_chatbot_provider_settings.workspace_id`
- API routes resolving active workspace.

## 7. Old Test Chat UI

### Test question input

Visible textarea:

- Placeholder: `Example: What are your support hours?`

### Answer display

The answer panel showed:

- Status.
- Reason.
- Answer text.

### Sources/citations display

No visible source/citation list was found in the active test chat UI.

### Debug/retrieval display

A comprehensive Retrieval Debug UI existed in source but was disabled with `&& false`, so it was not visible.

Hidden debug included:

- Query.
- Provider/embedding status.
- Retrieval candidate counts.
- Embedding counts.
- Run backfill button.
- Fallback reason.
- Calculation.
- Full-context fallback details.
- Detected intent.
- Terms.
- Selected evidence, scores, match types, and rerank reasons.

### Model/status shown

Visible status was answer `status` and `reason`.

Provider model was configured in Provider Settings, not repeated in the test answer panel.

### Logs saved or displayed

Backend stored AI chatbot logs in `ai_chatbot_logs`. The old dashboard did not show a dedicated chat logs panel in the visible AI Chatbot page.

### Fallback messages

The Test Chatbot response panel showed fallback/warning style for non-answered responses. Actual fallback text came from settings/backend.

### Buttons/actions

- `Ask Test Question`
- Hidden debug-only `Run Backfill`

Important recommendation:

- Do not restore the old retrieval debug as a customer-facing or default admin panel without redesign. It was hidden for a reason and contained many internals.

## 8. Old WhatsApp Auto-Reply UI

### Enable/disable auto-reply

The old Chatbot Instructions section had:

- Live WhatsApp auto-reply switch.

It required:

- Manage permission.
- Plan access.
- `enable_ai_auto_reply` permission.

### Workspace settings

Workspace-scoped settings included:

- Chatbot enabled.
- Auto-reply enabled.
- Tone.
- Fallback message.
- Handover enabled.
- Handover message.

### Business hours/cooldown

No visible business-hours UI was found in the old AI Chatbot dashboard.

Cooldowns existed in backend code, including environment-driven values in `conversation-controls.ts`, but they were not exposed as dashboard fields.

### Human handoff options

Visible:

- Handover enabled switch.
- Handover message textarea.

Inbox integration:

- Conversation controls in `src/components/inbox/message-thread.tsx` supported AI statuses:
  - `ai_active`
  - `ai_paused`
  - `needs_human`
- Buttons in the inbox thread allowed:
  - Pause AI.
  - Resume AI.
  - Mark Needs Human behavior through status controls.

### Fallback behavior settings

Visible:

- Fallback message textarea.

### Controls for AI answering WhatsApp messages

Visible dashboard controls:

- Chatbot enabled.
- Live WhatsApp auto-reply on/off.
- Provider configured.
- Knowledge sources.
- Fallback/handover messages.

Inbox controls:

- Pause/resume AI per conversation.
- Needs human status.

Backend:

- `src/lib/ai/auto-reply.ts`
- `src/lib/ai/conversation-controls.ts`

### Safety/strictness settings

Visible:

- Tone.
- Fallback message.
- Handover enabled/message.
- Auto-reply enable switch.

Not visible:

- Detailed retrieval strictness.
- Guardrail thresholds.
- Cooldown seconds.
- Daily reply limit.

### Related permissions

- `view_ai_chatbot`
- `manage_ai_chatbot`
- `enable_ai_auto_reply`

## 9. Old Logs / Analytics / History UI

### Chat logs

Database table:

- `ai_chatbot_logs`

Backend wrote logs, but no visible full chat logs panel was found in the old dashboard.

### AI response logs

Stored backend-side through `ai_chatbot_logs`.

Visible UI:

- Test answer panel showed current test result only.
- No paginated AI response log table was found in the old AI dashboard.

### Failed answer logs

Knowledge gap logging existed separately.

Visible UI:

- Unanswered Questions section.

### Knowledge gap logs

Visible:

- Unanswered Questions list.
- Count/grouping.
- Channel.
- Last asked.
- Suggested admin note.
- Language distribution.
- Add to Knowledge Base action.

Database:

- `ai_knowledge_gaps`

### Import history

Visible:

- Import history table inside Schedule & History.

Database:

- `ai_import_history`

### Scrape schedules

Visible:

- Add/edit/pause/resume/deactivate scheduled imports.

Database:

- `ai_scrape_schedules`

### Filters/search/statuses

Visible:

- Import history load-more.
- No explicit search/filter UI was found for gaps or logs.
- Import history table showed status/trigger/change summary but no filter controls.

### Actions available

- Review & Publish draft from import history.
- Load More.
- Add knowledge gap to Knowledge Base.
- View all/recent gaps.
- Manage schedules.

## 10. Old Contact AI Memory UI

Old contact memory UI did exist outside the main AI Chatbot page, inside the contact detail drawer/page.

Files:

- `src/components/contacts/contact-detail-view.tsx`
- `src/app/api/contacts/[id]/memory/route.ts`
- `src/lib/ai/memory.ts`

### Contact memory tab

The contact detail view had a tab:

- `AI Memory`

### Conversation summaries

The tab displayed recent summaries from:

- `ai_conversation_summaries`

It showed up to recent summaries and indicated if more existed.

### Memory fields

The UI displayed:

- Memory summary.
- Topics discussed.
- Last intent.
- Preferred language.
- Conversation count.
- Last conversation timestamp.
- Unresolved questions.
- Recent summaries.

### Update/delete actions

Actions:

- Enable/disable memory for that contact.
- Clear Memory.

Clear warning:

- It warned that stored memory would be cleared and future chatbot responses would no longer use past context.

### How it appeared in contact detail page

It was a contact detail tab beside other contact information tabs, not inside the AI Chatbot dashboard itself.

### Related APIs

- `GET /api/contacts/[id]/memory`
- `PATCH /api/contacts/[id]/memory`
- `DELETE /api/contacts/[id]/memory`

Database tables:

- `ai_contact_memories`
- `ai_conversation_summaries`

## 11. Old Permissions / Team Access

### Permissions related to AI Chatbot

Old AI permissions:

- `view_ai_chatbot`
- `manage_ai_chatbot`
- `enable_ai_auto_reply`

These appeared in:

- `src/lib/team/permissions.ts`
- `supabase/migrations/033_ai_chatbot.sql`
- Old RLS policies on AI tables.

### Sidebar visibility logic

Old sidebar item:

- `/ai-chatbot`
- Label: `AI Chatbot`
- Icon: `Bot`
- Required permission: `view_ai_chatbot`

File:

- `src/components/layout/sidebar.tsx`

### Team role controls

The permission constants included old AI permissions, so they were available to the team permissions system. Manager defaults included AI permissions through migration `033_ai_chatbot.sql`.

### Admin-only/manage controls

Most write actions required `manage_ai_chatbot`, including:

- Provider save/test.
- Firecrawl save/test.
- Knowledge create/update/delete.
- Website import.
- Publish/discard drafts.
- Schedules.
- Rechunk/restructure.

### Provider settings permission

Provider route used:

- View: `view_ai_chatbot`
- Manage: `manage_ai_chatbot`

### Auto-reply permission

Auto-reply enablement required:

- `enable_ai_auto_reply`

The page also checked plan access (`state.planAccess.canUseAutoReply`).

## 12. Old API routes used by UI

| Route | Methods found | UI/backend purpose |
| --- | --- | --- |
| `/api/ai-chatbot` | `GET`, `PUT`, `POST` | Load dashboard state; save chatbot settings; add manual knowledge |
| `/api/ai-chatbot/provider` | `GET`, `PUT`, `POST` | Load/save/test AI provider settings |
| `/api/ai-chatbot/provider/embeddings` | `POST` | Test embeddings or run embedding backfill depending body |
| `/api/ai-chatbot/firecrawl` | `GET`, `PUT`, `POST` | Load/save/test Firecrawl key and credits |
| `/api/ai-chatbot/website-import` | `GET`, `POST` | List latest jobs; start website import |
| `/api/ai-chatbot/website-import/[id]` | `GET`, `PATCH` | Poll job details; publish/discard/update draft |
| `/api/ai-chatbot/sources/[id]` | `PUT`, `DELETE` | Edit/delete knowledge source and refresh chunks |
| `/api/ai-chatbot/test` | `POST` | Dashboard test question |
| `/api/ai-chatbot/gaps` | `GET` | Load unanswered questions/knowledge gaps |
| `/api/ai-chatbot/rechunk` | `POST` | Re-chunk one/all active knowledge sources; UI was hidden |
| `/api/ai-chatbot/restructure` | `POST` | Create AI-structured review draft from an existing website source |
| `/api/ai-chatbot/schedules` | `GET`, `POST` | List/create scrape schedules |
| `/api/ai-chatbot/schedules/[id]` | `PATCH`, `DELETE` | Update/pause/resume/toggle/deactivate scrape schedule |
| `/api/ai-chatbot/import-history` | `GET` | Load scheduled/manual import history |
| `/api/ai-chatbot/conversations/[id]` | `GET`, `PUT` | Read/update per-conversation AI status from inbox |
| `/api/ai-chatbot/structured-offers/backfill` | `GET`, `POST` | Structured offer backfill/debug admin route; no visible dashboard button found in main page |
| `/api/contacts/[id]/memory` | `GET`, `PATCH`, `DELETE` | Contact AI Memory tab load/toggle/clear |

## 13. Old database tables referenced by UI/backend

Tables actually found in old code/migrations:

- `ai_chatbot_settings`
- `ai_knowledge_sources`
- `ai_knowledge_chunks`
- `ai_chatbot_logs`
- `ai_chatbot_provider_settings`
- `ai_conversation_controls`
- `ai_website_import_jobs`
- `ai_website_import_pages`
- `ai_firecrawl_settings`
- `ai_knowledge_gaps`
- `ai_scrape_schedules`
- `ai_import_history`
- `ai_contact_memories`
- `ai_conversation_summaries`

Other database objects found:

- `public.set_ai_knowledge_chunk_search_fields()`
- trigger `set_ai_knowledge_chunk_search_fields` on `ai_knowledge_chunks`
- `public.match_ai_knowledge_chunks(...)`
- HNSW/vector index on `ai_knowledge_chunks.embedding`
- search/vector indexes on `ai_knowledge_chunks`
- RLS policies based on `view_ai_chatbot` and `manage_ai_chatbot`

Shared extensions:

- The old AI system used pgvector, but this audit did not modify extensions or database objects.

## 14. Which old UI ideas may be useful to bring back

### A. Good UI ideas worth considering for new RAG

These are UI ideas only; they do not require restoring old retrieval logic:

1. Website import draft review before publish.
2. Import summary with imported/skipped/failed/duplicate counts.
3. Page-level import status list with skip reasons.
4. Import quality warnings.
5. Firecrawl credits/concurrency display after connection test.
6. Scheduled re-scrape UI, if rebuilt cleanly later.
7. Import history table with Review & Publish for draft updates.
8. Unanswered Questions / knowledge gaps dashboard.
9. Add unanswered question to Knowledge Base.
10. Contact AI Memory tab, if rebuilt with the new RAG memory architecture.
11. Simple provider test and Firecrawl test buttons.
12. Clear per-source knowledge preview/edit/delete.
13. Auto-reply readiness checklist/status cards.
14. Inbox-level Pause AI / Resume AI / Needs Human controls.

### B. UI ideas to avoid because they created complexity

1. Exposing complex retrieval internals in normal dashboard flow.
2. Large debug panels with exact/keyword/vector/rerank scores as a default UI.
3. Selected-offer or derived-guidance style answer controls.
4. Calculation/debug/fallback reason UI as a normal operator feature.
5. Re-chunk/restructure/backfill controls without clear user-facing meaning.
6. Too many provider/embedding/structuring/memory switches in one long settings section.
7. Any UI that can encourage users to tune answer scoring rather than improve knowledge quality.

### C. Import-related UI ideas that can be reused safely

1. BYOK Firecrawl key save/test.
2. Page limit selector.
3. Import progress panel.
4. Import summary metrics.
5. Pages checked with statuses and skip reasons.
6. Editable draft before publishing.
7. Discard draft / Publish draft buttons.
8. Import history timeline.
9. Scheduled scrape controls, later and only if simple.
10. Import warnings with plain-language explanations.

### D. Answer/retrieval-related UI ideas that should not be restored

1. Old hybrid retrieval scoring controls/debug as a default UI.
2. Old deterministic calculation-engine debug.
3. Old full-context fallback debug text.
4. Old selected evidence/rerank details as standard admin UI.
5. Old structured-offer backfill as a visible business-user action.
6. Old answer pipeline internals that caused prompt/context leakage risk.

## 15. Gap comparison with current new RAG UI

Current comparison file inspected:

- `src/app/(dashboard)/ai-chatbot/page.tsx`

| Feature | Old Chatbot AI UI | Current RAG UI | Should restore? | Notes |
| ------- | ----------------- | -------------- | --------------- | ----- |
| Sidebar AI Chatbot page | Yes, permission `view_ai_chatbot` | Yes, current RAG page exists | Already present | Permission names changed to RAG permissions |
| Top readiness/status cards | Chatbot, Auto-reply, AI provider | AI Provider, Firecrawl, Knowledge Sources, Embeddings, Embedding Issues, WhatsApp Auto Reply | Already present | Current cards are cleaner |
| Provider settings | Provider/model/API key/base URL/embeddings/structuring/memory | Provider/API key save/test | Partially | Keep current simple UI; only add model/base URL if truly needed |
| Firecrawl settings | Save/test key plus credits/concurrency metrics | Save/test key | Maybe | Credits/concurrency display is useful if easy/safe |
| Manual knowledge | Type/title/content with 100k manual limit | Title/text with current RAG limits | Already present | Current has cleaner processing progress |
| Website import | URL/page limit/draft review/pages checked/warnings | URL import with stats, no visible draft review flow | Partially | Draft review and page details are useful to rebuild safely |
| Knowledge list | Preview, edit, delete, restructure draft | List, prepare, view, edit, delete | Already present | Current “Prepare for Chatbot” is clearer than old hidden backfill |
| Prepare/embedding action | Mostly hidden/debug; visible Test Embeddings | Visible Prepare for Chatbot | Current is better | Keep current approach |
| Test chat | Question/answer; hidden debug | Test chat with retrieved knowledge and memory messages | Already present | Current is closer to starter RAG behavior |
| Chat logs | Stored in DB, no visible dashboard logs | Visible Logs section | Current is better | Keep current logs |
| Auto-reply settings | Chatbot enabled, fallback/handover, live auto-reply | WhatsApp auto-reply enabled, mode, fallback message/readiness | Partially | Old had more handover controls; restore only if needed |
| Inbox AI controls | Pause/resume/needs human | Needs separate current audit if still present | Maybe | Useful operational control, but protect webhook/WhatsApp logic |
| Knowledge gaps | Visible Unanswered Questions | Not found as old-style gaps panel in current RAG page | Yes, later | Good high-value UI for improving KB |
| Import history | Visible table | Not found in current RAG page | Yes, later | Useful after import pipeline stabilizes |
| Scheduled re-scraping | Visible schedules UI | Not found in current RAG page | Later only | Useful but not first priority |
| Contact memory UI | Contact detail AI Memory tab | Current status not audited deeply here | Maybe later | High value if memory feature returns |
| Multilingual settings | Backend fields existed, no visible panel | Not visible in current RAG page | No immediate restore | Avoid unless real customer need |
| Retrieval debug | Hidden in old UI | Current retrieved knowledge shown, not old score debug | Do not restore old debug | Keep safe, simple evidence display |
| Re-chunk controls | Hidden | Current prepare/chunk flow visible | Do not restore old hidden controls | Current wording is better |
| AI structuring controls | Visible provider section + import metrics | Not visible in current RAG page | Maybe later | Only if import quality requires it |
| Structured-offer backfill | Route existed; no visible main UI | Not present | No | Old answer-complexity path should stay removed |

## 16. Screenshots / UI reconstruction notes

No old UI screenshots were generated.

Reason:

- The task is report-only.
- Running old code from before removal would require checking out an older app state and possibly old database structures that have since been cleaned up.
- That would be unnecessary and risk confusion.

The old UI was reconstructed from source code at `63b26e0^`, especially:

- `src/app/(dashboard)/ai-chatbot/page.tsx`
- old API route files
- old migrations
- sidebar and permission files
- contact memory and inbox integration files

Uncertainty:

- Some source blocks existed but were deliberately hidden with `&& false`; these are documented as hidden/disabled, not active UI.
- The old UI may have looked slightly different at earlier commits, but `63b26e0^` is the best snapshot immediately before removal.
- This audit did not execute the old dashboard or query production data.

## 17. Final recommendation

### Old UI options that are safe to copy into the new RAG UI

Highest priority:

1. Import draft review before publishing.
2. Page-level import results with skipped/failed reasons.
3. Import quality warnings.
4. Import history.
5. Knowledge gaps / unanswered questions.
6. Firecrawl account status metrics after test.
7. Clean auto-reply readiness status.

Medium priority:

1. Scheduled re-scraping, but only after current import quality is stable.
2. Contact memory UI, but only if the new RAG memory system is rebuilt cleanly.
3. Simple handover/fallback message settings.

### Old UI options that should not be copied

1. Old hybrid retrieval debug panel.
2. Old scoring/rerank/exact/keyword/vector candidate UI.
3. Old calculation-engine debug UI.
4. Old structured-offer backfill/admin controls.
5. Old full-context fallback internals.
6. Dense all-in-one provider settings with too many advanced toggles.

### UI that should be implemented first

Recommended order for clean new RAG UI improvements:

1. Website import draft review before publishing.
2. Page-level import status and skip reasons.
3. Import history.
4. Knowledge gaps/unanswered questions.
5. Firecrawl credits/status refresh.
6. Optional scheduled re-scraping.
7. Optional contact memory.

### What should remain removed

The old answer/retrieval engine should remain removed:

- Old `src/lib/ai/retrieval.ts` behavior.
- Old deterministic pricing/calculation pipeline.
- Old selected-offer and derived-guidance logic.
- Old complex fallback preview system.
- Old `ai_*` database tables.
- Old prompt/debug text paths.

The useful part of the old feature was not the answer engine; it was the operator UI around import review, status, history, unanswered questions, and operational controls.

## Audit completion confirmation

- Old UI code was found in git history.
- Old UI was audited from `63b26e0^`.
- No old code was restored.
- No app code was changed.
- No database was modified.
- No deployment was performed.
- No secrets were read or exposed.
- This report file is the only intended output of the task.
