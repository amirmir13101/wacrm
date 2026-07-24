-- Platform-admin managed blog publishing.
-- Additive only: existing code-managed articles remain unchanged.

CREATE TABLE IF NOT EXISTS public.blog_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  title TEXT NOT NULL,
  seo_title TEXT NOT NULL,
  description TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content_markdown TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Guide',
  author TEXT NOT NULL DEFAULT 'TalkWagon Editorial Team',
  reading_time TEXT NOT NULL DEFAULT '8 min read',
  primary_keyword TEXT,
  secondary_keywords TEXT[] NOT NULL DEFAULT '{}',
  hero_image_url TEXT,
  hero_image_alt TEXT,
  hero_image_width INTEGER NOT NULL DEFAULT 1600 CHECK (hero_image_width > 0),
  hero_image_height INTEGER NOT NULL DEFAULT 900 CHECK (hero_image_height > 0),
  faqs JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(faqs) = 'array'),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_articles_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT blog_articles_slug_unique UNIQUE (slug),
  CONSTRAINT blog_articles_published_at_required CHECK (
    status = 'draft' OR published_at IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_blog_articles_status_published_at
  ON public.blog_articles(status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_articles_updated_at
  ON public.blog_articles(updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_blog_articles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_blog_articles_updated_at ON public.blog_articles;
CREATE TRIGGER set_blog_articles_updated_at
BEFORE UPDATE ON public.blog_articles
FOR EACH ROW
EXECUTE FUNCTION public.set_blog_articles_updated_at();

ALTER TABLE public.blog_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published blog articles are public" ON public.blog_articles;
CREATE POLICY "Published blog articles are public"
ON public.blog_articles
FOR SELECT
TO anon, authenticated
USING (
  status = 'published'
  AND published_at IS NOT NULL
  AND published_at <= NOW()
);

REVOKE ALL ON TABLE public.blog_articles FROM anon, authenticated;
GRANT SELECT ON TABLE public.blog_articles TO anon, authenticated;
GRANT ALL ON TABLE public.blog_articles TO service_role;

REVOKE ALL ON FUNCTION public.set_blog_articles_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_blog_articles_updated_at() TO service_role;
