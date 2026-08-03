-- Migration: 20260803162000_google_user_tokens.sql
-- Description: Table for storing Google OAuth tokens per user securely

CREATE TABLE IF NOT EXISTS public.user_google_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security
ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_google_tokens TO authenticated;
GRANT ALL ON public.user_google_tokens TO service_role;

-- Policies (Only owner can read/write their token)
CREATE POLICY "Own google tokens" ON public.user_google_tokens 
  FOR ALL TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_google_tokens_updated_at 
  BEFORE UPDATE ON public.user_google_tokens 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
