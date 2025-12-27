-- Table for shortId to articleId mapping (instead of Redis)
CREATE TABLE public.moderation_short_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id VARCHAR(8) NOT NULL UNIQUE,
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days')
);

-- Index for fast lookup
CREATE INDEX idx_moderation_short_ids_short_id ON public.moderation_short_ids(short_id);
CREATE INDEX idx_moderation_short_ids_article_id ON public.moderation_short_ids(article_id);

-- Table for pending rejection states (instead of Redis)
CREATE TABLE public.pending_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_telegram_id BIGINT NOT NULL,
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  short_id VARCHAR(8) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX idx_pending_rejections_admin ON public.pending_rejections(admin_telegram_id);

-- Table for moderation logs
CREATE TABLE public.moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  moderator_telegram_id BIGINT NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('approved', 'rejected')),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_moderation_logs_article ON public.moderation_logs(article_id);

-- Enable RLS
ALTER TABLE public.moderation_short_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies - these are internal tables, only accessible via service role
CREATE POLICY "Service role only" ON public.moderation_short_ids FOR ALL USING (false);
CREATE POLICY "Service role only" ON public.pending_rejections FOR ALL USING (false);
CREATE POLICY "Service role only" ON public.moderation_logs FOR ALL USING (false);

-- Function to generate short ID
CREATE OR REPLACE FUNCTION public.generate_short_id()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Function to get or create short ID for article
CREATE OR REPLACE FUNCTION public.get_or_create_short_id(p_article_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_short_id TEXT;
BEGIN
  -- Try to find existing
  SELECT short_id INTO v_short_id FROM moderation_short_ids WHERE article_id = p_article_id;
  
  IF v_short_id IS NOT NULL THEN
    RETURN v_short_id;
  END IF;
  
  -- Generate new unique short ID
  LOOP
    v_short_id := generate_short_id();
    BEGIN
      INSERT INTO moderation_short_ids (short_id, article_id) VALUES (v_short_id, p_article_id);
      RETURN v_short_id;
    EXCEPTION WHEN unique_violation THEN
      -- Try again with new short ID
    END;
  END LOOP;
END;
$$;