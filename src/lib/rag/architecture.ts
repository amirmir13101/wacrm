/**
 * Phase 1 architecture notes for keeping the CRM rebuild close to the
 * working local RAG starter while still fitting production CRM constraints.
 */

export const RAG_STARTER_PARITY_BEHAVIOR = [
  'sentence_and_paragraph_chunking',
  'feature_level_supports_chunks',
  'one_embedding_per_chunk',
  'cosine_similarity_vector_search',
  'similarity_threshold_0_5',
  'top_4_retrieved_chunks',
  'simple_tool_or_context_grounded_prompt',
  'clean_knowledge_unavailable_fallback',
] as const

export const RAG_DATABASE_ADAPTER_OPTIONS = {
  supabase_rpc: {
    label: 'Supabase client + RPC',
    tradeOffs: [
      'fits the existing CRM data-access style',
      'keeps workspace/auth/RLS integration simpler',
      'requires fewer new dependencies',
      'can preserve pgvector cosine search through SQL/RPC',
    ],
  },
  drizzle_direct_postgres: {
    label: 'Drizzle/direct Postgres for RAG only',
    tradeOffs: [
      'closest to the local starter schema and query style',
      'requires a direct Postgres connection string',
      'adds a second database access style inside the CRM',
      'must be isolated so existing CRM Supabase code is untouched',
    ],
  },
} as const

export const RECOMMENDED_RAG_DATABASE_ADAPTER = 'supabase_rpc' as const

export const RAG_QUALITY_COMPARISON_QUESTIONS = [
  'What is the support email?',
  'Do you have Singapore VPS location?',
  'What is the Singapore test IP?',
  'What is the monthly price of VPS x4?',
  'What is the yearly price of VPS x4?',
  'Do you sell laptops?',
] as const

export const RAG_QUALITY_DIFFERENCE_REASONS = [
  'chunking difference',
  'embedding model difference',
  'vector query difference',
  'prompt difference',
  'model difference',
  'retrieved chunks difference',
] as const
